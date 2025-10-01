// backend/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { 
      userId: userId,
      id: userId // Include both for compatibility
    }, 
    process.env.JWT_SECRET, 
    { 
      expiresIn: process.env.JWT_EXPIRE || '7d' 
    }
  );
};

// Validate registration data
const validateRegistrationData = (data) => {
  const errors = {};
  const { username, email, password, full_name, bio, github_username, linkedin_url } = data;

  // Username validation
  if (!username || username.trim().length < 3) {
    errors.username = 'Username must be at least 3 characters long';
  } else if (username.trim().length > 50) {
    errors.username = 'Username must be less than 50 characters';
  } else if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
    errors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
  }

  // Email validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Please enter a valid email address';
  }

  // Password validation
  if (!password || password.length < 8) {
    errors.password = 'Password must be at least 8 characters long';
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
  }

  // Full name validation
  if (!full_name || full_name.trim().length < 2) {
    errors.full_name = 'Full name must be at least 2 characters long';
  } else if (full_name.trim().length > 100) {
    errors.full_name = 'Full name must be less than 100 characters';
  }

  // Bio validation (optional)
  if (bio && bio.trim().length > 500) {
    errors.bio = 'Bio must be less than 500 characters';
  }

  // GitHub username validation (optional)
  if (github_username && (github_username.trim().length < 1 || github_username.trim().length > 39)) {
    errors.github_username = 'GitHub username must be between 1 and 39 characters';
  } else if (github_username && !/^[a-zA-Z0-9]([a-zA-Z0-9-])*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(github_username.trim())) {
    errors.github_username = 'Please enter a valid GitHub username';
  }

  // LinkedIn URL validation (optional)
  if (linkedin_url && !/^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-_]+\/?$/.test(linkedin_url)) {
    errors.linkedin_url = 'Please enter a valid LinkedIn profile URL';
  }

  return errors;
};

// Register user
const register = async (req, res) => {
  try {
    const { password, ...safeRequestData } = req.body;
    console.log('Registration request received for user:', safeRequestData.username || safeRequestData.email);
    
    // Validate input data
    const validationErrors = validateRegistrationData(req.body);
    if (Object.keys(validationErrors).length > 0) {
      console.log('Validation errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    const { username, email, full_name, bio, github_username, linkedin_url } = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existingUser) {
      console.log('User already exists:', username);
      
      if (existingUser.username === username && existingUser.email === email) {
        return res.status(400).json({
          success: false,
          message: 'An account with this username and email already exists'
        });
      } else if (existingUser.username === username) {
        return res.status(400).json({
          success: false,
          message: 'This username is already taken'
        });
      } else if (existingUser.email === email) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists'
        });
      }
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);
    console.log('Password hashed successfully for user:', username);

    // Create user in database
    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password_hash,
        full_name: full_name.trim(),
        bio: bio ? bio.trim() : null,
        github_username: github_username ? github_username.trim() : null,
        linkedin_url: linkedin_url ? linkedin_url.trim() : null,
        years_experience: 0,
        role: 'user', // Default role
        is_active: true
      }])
      .select('id, username, email, full_name, bio, github_username, linkedin_url, years_experience, role, created_at')
      .single();

    if (error) {
      console.error('Database error during registration:', error);
      
      if (error.code === '23505') { // Unique constraint violation
        if (error.message.includes('username')) {
          return res.status(400).json({
            success: false,
            message: 'This username is already taken'
          });
        } else if (error.message.includes('email')) {
          return res.status(400).json({
            success: false,
            message: 'An account with this email already exists'
          });
        }
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to create user account',
        error: error.message
      });
    }

    console.log('User created successfully:', user.username);

    // Generate JWT token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          ...user,
          needsOnboarding: true
        },
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/email and password are required'
      });
    }

    console.log('Login attempt for user:', identifier);
    
    // Find user by username or email - include role
    const { data: user, error } = await supabase
      .from('users')
      .select('*') // Select all fields including role
      .or(`username.eq.${identifier.trim()},email.eq.${identifier.toLowerCase().trim()}`)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      console.log('Login failed: User not found or inactive for identifier:', identifier);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is suspended
    if (user.is_suspended) {
      const suspendedUntil = user.suspended_until ? new Date(user.suspended_until) : null;
      const now = new Date();
      
      if (!suspendedUntil || now < suspendedUntil) {
        return res.status(403).json({
          success: false,
          message: user.suspension_reason || 'Your account has been suspended',
          suspended_until: user.suspended_until
        });
      } else {
        // Suspension expired, automatically unsuspend
        await supabase
          .from('users')
          .update({
            is_suspended: false,
            suspended_until: null,
            suspension_reason: null
          })
          .eq('id', user.id);
        
        user.is_suspended = false;
        user.suspended_until = null;
        user.suspension_reason = null;
      }
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      console.log('Login failed: Invalid password for user:', identifier);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('User authenticated successfully:', user.username);

    // Update last login time
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Get user's programming languages
    const { data: userLanguages } = await supabase
      .from('user_programming_languages')
      .select(`
        id,
        proficiency_level,
        years_experience,
        programming_languages (id, name, description)
      `)
      .eq('user_id', user.id);

    // Get user's topics
    const { data: userTopics } = await supabase
      .from('user_topics')
      .select(`
        id,
        interest_level,
        experience_level,
        topics (id, name, description, category)
      `)
      .eq('user_id', user.id);

    // Check if user has completed onboarding
    const needsOnboarding = !userLanguages || userLanguages.length === 0;

    // Generate JWT token
    const token = generateToken(user.id);

    // Remove password_hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          ...userWithoutPassword,
          needsOnboarding,
          programming_languages: userLanguages || [],
          topics: userTopics || []
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user basic info
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id, username, email, full_name, bio, github_username, linkedin_url, 
        years_experience, role, created_at, updated_at, avatar_url
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's programming languages
    const { data: languages } = await supabase
      .from('user_programming_languages')
      .select(`
        id,
        proficiency_level,
        years_experience,
        programming_languages (id, name, description)
      `)
      .eq('user_id', userId);

    // Get user's topics
    const { data: topics } = await supabase
      .from('user_topics')
      .select(`
        id,
        interest_level,
        experience_level,
        topics (id, name, description, category)
      `)
      .eq('user_id', userId);

    // Check if user has completed onboarding
    const needsOnboarding = !languages || languages.length === 0;

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          needsOnboarding,
          programming_languages: languages || [],
          topics: topics || []
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, bio, github_username, linkedin_url, years_experience } = req.body;

    // Validate input
    const errors = {};
    if (full_name && (full_name.trim().length < 2 || full_name.trim().length > 100)) {
      errors.full_name = 'Full name must be between 2 and 100 characters';
    }
    if (bio && bio.trim().length > 500) {
      errors.bio = 'Bio must be less than 500 characters';
    }
    if (github_username && !/^[a-zA-Z0-9]([a-zA-Z0-9-])*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(github_username.trim())) {
      errors.github_username = 'Please enter a valid GitHub username';
    }
    if (linkedin_url && !/^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-_]+\/?$/.test(linkedin_url)) {
      errors.linkedin_url = 'Please enter a valid LinkedIn profile URL';
    }
    if (years_experience !== undefined && (years_experience < 0 || years_experience > 50)) {
      errors.years_experience = 'Years of experience must be between 0 and 50';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Update user profile
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (full_name !== undefined) updateData.full_name = full_name.trim();
    if (bio !== undefined) updateData.bio = bio ? bio.trim() : null;
    if (github_username !== undefined) updateData.github_username = github_username ? github_username.trim() : null;
    if (linkedin_url !== undefined) updateData.linkedin_url = linkedin_url ? linkedin_url.trim() : null;
    if (years_experience !== undefined) updateData.years_experience = years_experience;

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select(`
        id, username, email, full_name, bio, github_username, linkedin_url, 
        years_experience, role, created_at, updated_at
      `)
      .single();

    if (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Validate new password
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }

    // Get current user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Change password error:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to change password'
      });
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Logout (client-side mainly, but can be used for logging)
const logout = async (req, res) => {
  try {
    // In a more complex setup, you might want to blacklist the token
    // For now, we'll just return success
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
};