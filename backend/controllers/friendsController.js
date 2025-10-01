// backend/controllers/friendsController.js
const supabase = require('../config/supabase');

// Send friend request
const sendFriendRequest = async (req, res) => {
  try {
    const requesterId = req.user.id;
    const { addresseeId } = req.body;

    // Validate input
    if (!addresseeId) {
      return res.status(400).json({
        success: false,
        message: 'Addressee ID is required'
      });
    }

    // Check if trying to send request to self
    if (requesterId === addresseeId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself'
      });
    }

    // Check if addressee exists
    const { data: addressee, error: addresseeError } = await supabase
      .from('users')
      .select('id, full_name, username')
      .eq('id', addresseeId)
      .single();

    if (addresseeError || !addressee) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if friendship already exists (in either direction)
    const { data: existingFriendship, error: checkError } = await supabase
      .from('user_friendships')
      .select('*')
      .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing friendship:', checkError);
      return res.status(500).json({
        success: false,
        message: 'Failed to check existing friendship'
      });
    }

    if (existingFriendship) {
      let message = 'Friend request already exists';
      if (existingFriendship.status === 'accepted') {
        message = 'You are already friends with this user';
      } else if (existingFriendship.status === 'blocked') {
        message = 'Cannot send friend request to this user';
      }
      
      return res.status(400).json({
        success: false,
        message
      });
    }

    // Create friend request
    const { data: friendship, error: createError } = await supabase
      .from('user_friendships')
      .insert({
        requester_id: requesterId,
        addressee_id: addresseeId,
        status: 'pending'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating friendship:', createError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send friend request'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Friend request sent successfully',
      data: friendship
    });

  } catch (error) {
    console.error('Error in sendFriendRequest:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get user's friends and friend requests
const getFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all friendships where user is involved
    const { data: friendships, error: friendshipsError } = await supabase
      .from('user_friendships')
      .select(`
        *,
        requester:requester_id(id, full_name, username, avatar_url, github_username, years_experience),
        addressee:addressee_id(id, full_name, username, avatar_url, github_username, years_experience)
      `)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (friendshipsError) {
      console.error('Error fetching friendships:', friendshipsError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch friends'
      });
    }

    // Categorize friendships
    const friends = [];
    const sentRequests = [];
    const receivedRequests = [];

    friendships.forEach(friendship => {
      const isRequester = friendship.requester_id === userId;
      const friend = isRequester ? friendship.addressee : friendship.requester;

      if (friendship.status === 'accepted') {
        friends.push({
          ...friend,
          friendshipId: friendship.id,
          friendsSince: friendship.updated_at
        });
      } else if (friendship.status === 'pending') {
        if (isRequester) {
          sentRequests.push({
            ...friend,
            friendshipId: friendship.id,
            requestSent: friendship.created_at
          });
        } else {
          receivedRequests.push({
            ...friend,
            friendshipId: friendship.id,
            requestReceived: friendship.created_at
          });
        }
      }
    });

    res.json({
      success: true,
      data: {
        friends,
        sentRequests,
        receivedRequests,
        counts: {
          friends: friends.length,
          sentRequests: sentRequests.length,
          receivedRequests: receivedRequests.length
        }
      }
    });

  } catch (error) {
    console.error('Error in getFriends:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Accept friend request
const acceptFriendRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendshipId } = req.params;

    // Get the friendship and verify it exists and user is the addressee
    const { data: friendship, error: getError } = await supabase
      .from('user_friendships')
      .select('*')
      .eq('id', friendshipId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .single();

    if (getError || !friendship) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    // Update status to accepted
    const { data: updatedFriendship, error: updateError } = await supabase
      .from('user_friendships')
      .update({ 
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', friendshipId)
      .select()
      .single();

    if (updateError) {
      console.error('Error accepting friend request:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Failed to accept friend request'
      });
    }

    res.json({
      success: true,
      message: 'Friend request accepted',
      data: updatedFriendship
    });

  } catch (error) {
    console.error('Error in acceptFriendRequest:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Reject friend request
const rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendshipId } = req.params;

    // Get the friendship and verify it exists and user is the addressee
    const { data: friendship, error: getError } = await supabase
      .from('user_friendships')
      .select('*')
      .eq('id', friendshipId)
      .eq('addressee_id', userId)
      .eq('status', 'pending')
      .single();

    if (getError || !friendship) {
      return res.status(404).json({
        success: false,
        message: 'Friend request not found'
      });
    }

    // Delete the friendship request
    const { error: deleteError } = await supabase
      .from('user_friendships')
      .delete()
      .eq('id', friendshipId);

    if (deleteError) {
      console.error('Error rejecting friend request:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to reject friend request'
      });
    }

    res.json({
      success: true,
      message: 'Friend request rejected'
    });

  } catch (error) {
    console.error('Error in rejectFriendRequest:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Remove friend
const removeFriend = async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendshipId } = req.params;

    // Get the friendship and verify user is part of it
    const { data: friendship, error: getError } = await supabase
      .from('user_friendships')
      .select('*')
      .eq('id', friendshipId)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .single();

    if (getError || !friendship) {
      return res.status(404).json({
        success: false,
        message: 'Friendship not found'
      });
    }

    // Delete the friendship
    const { error: deleteError } = await supabase
      .from('user_friendships')
      .delete()
      .eq('id', friendshipId);

    if (deleteError) {
      console.error('Error removing friend:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to remove friend'
      });
    }

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });

  } catch (error) {
    console.error('Error in removeFriend:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  sendFriendRequest,
  getFriends,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend
};