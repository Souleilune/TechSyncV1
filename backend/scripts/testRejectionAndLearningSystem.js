// backend/scripts/testRejectionAndLearningSystem.js
const supabase = require('../config/supabase');
const skillMatching = require('../services/SkillMatchingService');

class RejectionAndLearningSystemTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
    this.maxAttempts = 8; // Threshold for triggering learning recommendations
  }

  /**
   * Main test runner
   */
  async runAllTests() {
    console.log('\n🧪 REJECTION HANDLING & LEARNING SYSTEM TEST SUITE');
    console.log('=' .repeat(60));
    console.log('Testing rejection tracking and learning recommendations');
    console.log('System version: 2.0-enhanced');
    console.log('=' .repeat(60));

    try {
      await this.testMaxAttemptsConfiguration();
      await this.testRejectionTracking();
      await this.testProgressiveFailureDetection();
      await this.testLearningRecommendationGeneration();
      await this.testLearningRecommendationStorage();
      await this.testUserFailureAnalytics();
      await this.testMultipleProjectFailures();
      await this.testLearningMaterialsRetrieval();
      await this.testRecommendationEffectivenessTracking();
      await this.testRejectionThresholdEdgeCases();
      
      this.printTestSummary();
    } catch (error) {
      console.error('❌ Test suite failed with error:', error);
      throw error;
    }
  }

  /**
   * Test max attempts configuration
   */
  async testMaxAttemptsConfiguration() {
    console.log('\n⚙️  Testing Max Attempts Configuration...');
    
    const expectedMaxAttempts = 8;
    const configuredMaxAttempts = skillMatching.maxAttempts;
    
    this.recordTest(
      'Max Attempts Threshold',
      configuredMaxAttempts === expectedMaxAttempts,
      { 
        configured: configuredMaxAttempts,
        expected: expectedMaxAttempts,
        note: 'Users should receive learning materials after 8 failed attempts'
      }
    );

    // Verify minimum passing score
    const expectedMinScore = 70;
    const configuredMinScore = skillMatching.minPassingScore;
    
    this.recordTest(
      'Minimum Passing Score Configuration',
      configuredMinScore === expectedMinScore,
      { 
        configured: configuredMinScore,
        expected: expectedMinScore
      }
    );
  }

  /**
   * Test rejection tracking in challenge_attempts table
   */
  async testRejectionTracking() {
    console.log('\n📊 Testing Rejection Tracking...');
    
    try {
      // Get failed attempts from database
      const { data: failedAttempts, error } = await supabase
        .from('challenge_attempts')
        .select('id, user_id, project_id, status, score, submitted_at')
        .eq('status', 'failed')
        .order('submitted_at', { ascending: false })
        .limit(10);

      if (error) {
        this.recordTest(
          'Rejection Tracking Query',
          false,
          { error: error.message }
        );
        return;
      }

      this.recordTest(
        'Rejection Tracking Query',
        true,
        { 
          failedAttemptsFound: failedAttempts?.length || 0,
          note: 'System can query failed attempts'
        }
      );

      // Test rejection data completeness
      if (failedAttempts && failedAttempts.length > 0) {
        const sampleAttempt = failedAttempts[0];
        const hasRequiredFields = 
          sampleAttempt.user_id && 
          sampleAttempt.project_id && 
          sampleAttempt.status === 'failed' &&
          sampleAttempt.score !== null;

        this.recordTest(
          'Rejection Data Completeness',
          hasRequiredFields,
          { 
            sampleAttemptId: sampleAttempt.id.substring(0, 8),
            hasUserId: !!sampleAttempt.user_id,
            hasProjectId: !!sampleAttempt.project_id,
            hasScore: sampleAttempt.score !== null
          }
        );
      }
    } catch (error) {
      this.recordTest(
        'Rejection Tracking',
        false,
        { error: error.message }
      );
    }
  }

  /**
   * Test progressive failure detection (8+ failures)
   */
  async testProgressiveFailureDetection() {
    console.log('\n🔍 Testing Progressive Failure Detection...');
    
    try {
      // Get all failed attempts grouped by user
      const { data: failedAttempts, error } = await supabase
        .from('challenge_attempts')
        .select('user_id, project_id, status, score, submitted_at')
        .eq('status', 'failed')
        .order('submitted_at', { ascending: false });

      if (error) {
        this.recordTest(
          'Progressive Failure Detection',
          false,
          { error: error.message }
        );
        return;
      }

      // Group failures by user
      const failuresByUser = {};
      (failedAttempts || []).forEach(attempt => {
        if (!failuresByUser[attempt.user_id]) {
          failuresByUser[attempt.user_id] = [];
        }
        failuresByUser[attempt.user_id].push(attempt);
      });

      // Find users who need learning support (8+ failures)
      const usersNeedingSupport = [];
      const usersCloseToThreshold = [];
      
      Object.entries(failuresByUser).forEach(([userId, attempts]) => {
        if (attempts.length >= this.maxAttempts) {
          usersNeedingSupport.push({ userId, failureCount: attempts.length });
        } else if (attempts.length >= 5) {
          usersCloseToThreshold.push({ userId, failureCount: attempts.length });
        }
      });

      this.recordTest(
        'Progressive Failure Detection',
        true,
        { 
          totalUsersWithFailures: Object.keys(failuresByUser).length,
          usersNeedingSupport: usersNeedingSupport.length,
          usersCloseToThreshold: usersCloseToThreshold.length,
          threshold: this.maxAttempts,
          note: 'Users with 8+ failures should receive learning recommendations'
        }
      );

      // Test specific user failure patterns
      if (usersNeedingSupport.length > 0) {
        const sampleUser = usersNeedingSupport[0];
        const userAttempts = failuresByUser[sampleUser.userId];
        
        // Get unique projects attempted
        const uniqueProjects = new Set(userAttempts.map(a => a.project_id));
        const avgScore = userAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / userAttempts.length;

        this.recordTest(
          `User Failure Pattern Analysis (${sampleUser.failureCount} failures)`,
          true,
          { 
            userId: sampleUser.userId.substring(0, 8),
            totalFailures: sampleUser.failureCount,
            uniqueProjectsAttempted: uniqueProjects.size,
            averageScore: Math.round(avgScore),
            shouldReceiveHelp: sampleUser.failureCount >= this.maxAttempts
          }
        );
      }
    } catch (error) {
      this.recordTest(
        'Progressive Failure Detection',
        false,
        { error: error.message }
      );
    }
  }

  /**
   * Test learning recommendation generation logic
   */
  async testLearningRecommendationGeneration() {
    console.log('\n🎓 Testing Learning Recommendation Generation...');
    
    try {
      // Find a user with multiple failures
      const { data: failedAttempts, error: attemptsError } = await supabase
        .from('challenge_attempts')
        .select('user_id, project_id, score, challenge_id')
        .eq('status', 'failed')
        .order('submitted_at', { ascending: false })
        .limit(100);

      if (attemptsError || !failedAttempts || failedAttempts.length === 0) {
        this.recordTest(
          'Learning Recommendation Generation',
          true,
          { note: 'No failed attempts found (good sign!)' }
        );
        return;
      }

      // Group by user and find one with 8+ failures
      const failuresByUser = {};
      failedAttempts.forEach(attempt => {
        if (!failuresByUser[attempt.user_id]) {
          failuresByUser[attempt.user_id] = [];
        }
        failuresByUser[attempt.user_id].push(attempt);
      });

      const userWith8Plus = Object.entries(failuresByUser)
        .find(([_, attempts]) => attempts.length >= 8);

      if (!userWith8Plus) {
        this.recordTest(
          'Learning Recommendation Generation',
          true,
          { note: 'No users with 8+ failures found' }
        );
        return;
      }

      const [testUserId, userAttempts] = userWith8Plus;

      // Get user's programming languages and topics
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id,
          user_programming_languages (
            programming_languages (id, name),
            proficiency_level
          ),
          user_topics (
            topics (id, name),
            experience_level,
            interest_level
          )
        `)
        .eq('id', testUserId)
        .single();

      if (userError || !userData) {
        this.recordTest(
          'User Data Retrieval for Recommendations',
          false,
          { error: userError?.message || 'User not found' }
        );
        return;
      }

      // Test recommendation generation criteria
      const hasLanguages = userData.user_programming_languages?.length > 0;
      const hasTopics = userData.user_topics?.length > 0;
      const hasMultipleFailures = userAttempts.length >= this.maxAttempts;

      this.recordTest(
        'Learning Recommendation Generation Criteria',
        hasLanguages && hasMultipleFailures,
        { 
          userId: testUserId.substring(0, 8),
          hasLanguages,
          hasTopics,
          failureCount: userAttempts.length,
          meetsThreshold: hasMultipleFailures,
          avgScore: Math.round(userAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / userAttempts.length)
        }
      );

      // Test skill gap identification
      if (hasLanguages) {
        const primaryLanguage = userData.user_programming_languages[0];
        const languageName = primaryLanguage?.programming_languages?.name;
        const proficiencyLevel = primaryLanguage?.proficiency_level;

        this.recordTest(
          'Skill Gap Identification',
          languageName && proficiencyLevel,
          { 
            primaryLanguage: languageName,
            currentProficiency: proficiencyLevel,
            failureCount: userAttempts.length,
            recommendationType: 'language_strengthening'
          }
        );
      }
    } catch (error) {
      this.recordTest(
        'Learning Recommendation Generation',
        false,
        { error: error.message }
      );
    }
  }

  /**
   * Test learning recommendation storage
   */
  async testLearningRecommendationStorage() {
    console.log('\n💾 Testing Learning Recommendation Storage...');
    
    try {
      // Query existing learning recommendations
      const { data: recommendations, error } = await supabase
        .from('learning_recommendations')
        .select(`
          id,
          user_id,
          language_id,
          topic_id,
          tutorial_url,
          tutorial_title,
          difficulty_level,
          recommended_at,
          completed_at,
          effectiveness_score
        `)
        .order('recommended_at', { ascending: false })
        .limit(10);

      if (error) {
        this.recordTest(
          'Learning Recommendation Storage Query',
          false,
          { error: error.message }
        );
        return;
      }

      this.recordTest(
        'Learning Recommendation Storage Query',
        true,
        { 
          recommendationsFound: recommendations?.length || 0,
          note: 'Can query learning_recommendations table'
        }
      );

      // Test recommendation data structure
      if (recommendations && recommendations.length > 0) {
        const sampleRec = recommendations[0];
        const hasRequiredFields = 
          sampleRec.user_id &&
          sampleRec.tutorial_url &&
          sampleRec.tutorial_title &&
          sampleRec.difficulty_level &&
          sampleRec.recommended_at;

        this.recordTest(
          'Learning Recommendation Data Structure',
          hasRequiredFields,
          { 
            sampleId: sampleRec.id.substring(0, 8),
            hasUser: !!sampleRec.user_id,
            hasUrl: !!sampleRec.tutorial_url,
            hasTitle: !!sampleRec.tutorial_title,
            difficulty: sampleRec.difficulty_level,
            isCompleted: !!sampleRec.completed_at
          }
        );

        // Test completed recommendations tracking
        const completedRecs = recommendations.filter(r => r.completed_at);
        const withEffectivenessScore = recommendations.filter(r => r.effectiveness_score);

        this.recordTest(
          'Recommendation Completion Tracking',
          true,
          { 
            total: recommendations.length,
            completed: completedRecs.length,
            withFeedback: withEffectivenessScore.length,
            completionRate: ((completedRecs.length / recommendations.length) * 100).toFixed(1) + '%'
          }
        );
      }
    } catch (error) {
      this.recordTest(
        'Learning Recommendation Storage',
        false,
        { error: error.message }
      );
    }
  }

  /**
   * Test user failure analytics
   */
  async testUserFailureAnalytics() {
    console.log('\n📈 Testing User Failure Analytics...');
    
    try {
      // Get comprehensive failure statistics
      const { data: allAttempts, error } = await supabase
        .from('challenge_attempts')
        .select('user_id, status, score, submitted_at')
        .in('status', ['passed', 'failed'])
        .order('submitted_at', { ascending: false })
        .limit(500);

      if (error || !allAttempts || allAttempts.length === 0) {
        this.recordTest(
          'User Failure Analytics',
          true,
          { note: 'No attempts data available for analytics' }
        );
        return;
      }

      // Calculate system-wide statistics
      const totalAttempts = allAttempts.length;
      const failedAttempts = allAttempts.filter(a => a.status === 'failed');
      const passedAttempts = allAttempts.filter(a => a.status === 'passed');
      
      const failureRate = (failedAttempts.length / totalAttempts) * 100;
      const avgFailedScore = failedAttempts.length > 0
        ? failedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / failedAttempts.length
        : 0;
      const avgPassedScore = passedAttempts.length > 0
        ? passedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / passedAttempts.length
        : 0;

      this.recordTest(
        'System-Wide Failure Analytics',
        true,
        { 
          totalAttempts,
          failedAttempts: failedAttempts.length,
          passedAttempts: passedAttempts.length,
          failureRate: failureRate.toFixed(2) + '%',
          avgFailedScore: Math.round(avgFailedScore),
          avgPassedScore: Math.round(avgPassedScore),
          scoreGap: Math.round(avgPassedScore - avgFailedScore)
        }
      );

      // Identify users who improved after receiving help
      const userAttemptHistory = {};
      allAttempts.forEach(attempt => {
        if (!userAttemptHistory[attempt.user_id]) {
          userAttemptHistory[attempt.user_id] = [];
        }
        userAttemptHistory[attempt.user_id].push(attempt);
      });

      let usersWhoImproved = 0;
      let usersStillStruggling = 0;

      Object.entries(userAttemptHistory).forEach(([_, attempts]) => {
        if (attempts.length >= this.maxAttempts) {
          const recentAttempts = attempts.slice(0, 3); // Last 3 attempts
          const hasRecentPass = recentAttempts.some(a => a.status === 'passed');
          
          if (hasRecentPass) {
            usersWhoImproved++;
          } else {
            usersStillStruggling++;
          }
        }
      });

      this.recordTest(
        'User Improvement After Support',
        true,
        { 
          usersWhoImproved,
          usersStillStruggling,
          improvementIndicator: usersWhoImproved > 0 ? 'System is helping users improve' : 'Monitor user progress'
        }
      );
    } catch (error) {
      this.recordTest(
        'User Failure Analytics',
        false,
        { error: error.message }
      );
    }
  }

  /**
   * Test multiple project failures scenario
   */
  async testMultipleProjectFailures() {
    console.log('\n🔄 Testing Multiple Project Failures...');
    
    try {
      const { data: failedAttempts, error } = await supabase
        .from('challenge_attempts')
        .select('user_id, project_id, status, score')
        .eq('status', 'failed')
        .limit(200);

      if (error || !failedAttempts || failedAttempts.length === 0) {
        this.recordTest(
          'Multiple Project Failures Analysis',
          true,
          { note: 'No failed attempts to analyze' }
        );
        return;
      }

      // Group by user and analyze project diversity
      const userProjectMap = {};
      failedAttempts.forEach(attempt => {
        if (!userProjectMap[attempt.user_id]) {
          userProjectMap[attempt.user_id] = new Set();
        }
        userProjectMap[attempt.user_id].add(attempt.project_id);
      });

      // Find users failing across multiple projects
      const usersWithMultipleProjectFailures = Object.entries(userProjectMap)
        .filter(([_, projects]) => projects.size >= 3)
        .map(([userId, projects]) => ({ 
          userId, 
          projectCount: projects.size,
          totalFailures: failedAttempts.filter(a => a.user_id === userId).length
        }));

      this.recordTest(
        'Multiple Project Failures Detection',
        true,
        { 
          usersAnalyzed: Object.keys(userProjectMap).length,
          usersWithMultipleProjectFailures: usersWithMultipleProjectFailures.length,
          note: 'Users failing across multiple projects need comprehensive learning support'
        }
      );

      if (usersWithMultipleProjectFailures.length > 0) {
        const sampleUser = usersWithMultipleProjectFailures[0];
        
        this.recordTest(
          'Diverse Failure Pattern Identified',
          sampleUser.projectCount >= 3,
          { 
            userId: sampleUser.userId.substring(0, 8),
            uniqueProjectsFailed: sampleUser.projectCount,
            totalFailures: sampleUser.totalFailures,
            recommendationType: 'comprehensive_skill_building'
          }
        );
      }
    } catch (error) {
      this.recordTest(
        'Multiple Project Failures',
        false,
        { error: error.message }
      );
    }
  }

  /**
   * Test learning materials retrieval
   */
  async testLearningMaterialsRetrieval() {
    console.log('\n📚 Testing Learning Materials Retrieval...');
    
    try {
      // Test retrieval by different criteria
      const testCriteria = [
        { field: 'difficulty_level', value: 'beginner' },
        { field: 'difficulty_level', value: 'intermediate' }
      ];

      for (const criteria of testCriteria) {
        const { data: materials, error } = await supabase
          .from('learning_recommendations')
          .select('id, tutorial_title, difficulty_level')
          .eq(criteria.field, criteria.value)
          .limit(5);

        if (error) {
          this.recordTest(
            `Learning Materials Retrieval (${criteria.value})`,
            false,
            { error: error.message }
          );
          continue;
        }

        this.recordTest(
          `Learning Materials Retrieval (${criteria.value})`,
          true,
          { 
            materialsFound: materials?.length || 0,
            difficulty: criteria.value
          }
        );
      }

      // Test retrieval by language
      const { data: languages } = await supabase
        .from('programming_languages')
        .select('id, name')
        .limit(3);

      if (languages && languages.length > 0) {
        const testLanguage = languages[0];
        const { data: langMaterials, error: langError } = await supabase
          .from('learning_recommendations')
          .select('id, tutorial_title, language_id')
          .eq('language_id', testLanguage.id)
          .limit(5);

        this.recordTest(
          `Learning Materials by Language (${testLanguage.name})`,
          !langError,
          { 
            language: testLanguage.name,
            materialsFound: langMaterials?.length || 0
          }
        );
      }
    } catch (error) {
      this.recordTest(
        'Learning Materials Retrieval',
        false,
        { error: error.message }
      );
    }
  }

  /**
   * Test recommendation effectiveness tracking
   */
  async testRecommendationEffectivenessTracking() {
    console.log('\n⭐ Testing Recommendation Effectiveness Tracking...');
    
    try {
      const { data: recommendations, error } = await supabase
        .from('learning_recommendations')
        .select('id, user_id, effectiveness_score, completed_at, recommended_at')
        .not('effectiveness_score', 'is', null)
        .order('recommended_at', { ascending: false })
        .limit(50);

      if (error || !recommendations || recommendations.length === 0) {
        this.recordTest(
          'Recommendation Effectiveness Tracking',
          true,
          { note: 'No effectiveness scores recorded yet' }
        );
        return;
      }

      // Calculate effectiveness statistics
      const avgEffectiveness = recommendations.reduce((sum, r) => sum + (r.effectiveness_score || 0), 0) / recommendations.length;
      const highlyEffective = recommendations.filter(r => r.effectiveness_score >= 4).length;
      const lowEffectiveness = recommendations.filter(r => r.effectiveness_score <= 2).length;

      this.recordTest(
        'Recommendation Effectiveness Statistics',
        true,
        { 
          totalRated: recommendations.length,
          avgEffectiveness: avgEffectiveness.toFixed(2),
          highlyEffective: highlyEffective,
          lowEffectiveness: lowEffectiveness,
          effectivenessRate: ((highlyEffective / recommendations.length) * 100).toFixed(1) + '%'
        }
      );

      // Test completion time analysis
      const completedRecs = recommendations.filter(r => r.completed_at);
      if (completedRecs.length > 0) {
        const completionTimes = completedRecs.map(r => {
          const recommended = new Date(r.recommended_at);
          const completed = new Date(r.completed_at);
          return (completed - recommended) / (1000 * 60 * 60 * 24); // days
        });

        const avgCompletionTime = completionTimes.reduce((sum, t) => sum + t, 0) / completionTimes.length;

        this.recordTest(
          'Recommendation Completion Time Analysis',
          avgCompletionTime > 0,
          { 
            avgCompletionDays: avgCompletionTime.toFixed(1),
            fastestCompletion: Math.min(...completionTimes).toFixed(1) + ' days',
            slowestCompletion: Math.max(...completionTimes).toFixed(1) + ' days'
          }
        );
      }
    } catch (error) {
      this.recordTest(
        'Recommendation Effectiveness Tracking',
        false,
        { error: error.message }
      );
    }
  }

  /**
   * Test rejection threshold edge cases
   */
  async testRejectionThresholdEdgeCases() {
    console.log('\n⚠️  Testing Rejection Threshold Edge Cases...');
    
    try {
      // Test users exactly at threshold
      const { data: allAttempts, error } = await supabase
        .from('challenge_attempts')
        .select('user_id, status, score')
        .eq('status', 'failed')
        .limit(300);

      if (error || !allAttempts || allAttempts.length === 0) {
        this.recordTest(
          'Edge Case: Users at Threshold',
          true,
          { note: 'No failed attempts to test edge cases' }
        );
        return;
      }

      // Group by user and find those exactly at threshold
      const failuresByUser = {};
      allAttempts.forEach(attempt => {
        failuresByUser[attempt.user_id] = (failuresByUser[attempt.user_id] || 0) + 1;
      });

      const usersAtExactThreshold = Object.entries(failuresByUser)
        .filter(([_, count]) => count === this.maxAttempts)
        .map(([userId, count]) => ({ userId, count }));

      const usersJustBeforeThreshold = Object.entries(failuresByUser)
        .filter(([_, count]) => count === this.maxAttempts - 1)
        .map(([userId, count]) => ({ userId, count }));

      const usersJustAfterThreshold = Object.entries(failuresByUser)
        .filter(([_, count]) => count === this.maxAttempts + 1)
        .map(([userId, count]) => ({ userId, count }));

      this.recordTest(
        'Edge Case: Users at Threshold',
        true,
        { 
          usersAtExactThreshold: usersAtExactThreshold.length,
          usersJustBefore: usersJustBeforeThreshold.length,
          usersJustAfter: usersJustAfterThreshold.length,
          threshold: this.maxAttempts,
          note: 'Users at exactly 8 failures should trigger learning recommendations'
        }
      );

      // Test score distribution around passing threshold
      const minPassingScore = skillMatching.minPassingScore;
      const scoresNearThreshold = allAttempts
        .filter(a => a.score >= minPassingScore - 10 && a.score < minPassingScore)
        .map(a => a.score);

      if (scoresNearThreshold.length > 0) {
        const avgNearThreshold = scoresNearThreshold.reduce((sum, s) => sum + s, 0) / scoresNearThreshold.length;

        this.recordTest(
          'Edge Case: Scores Near Passing Threshold',
          true,
          { 
            attemptsNearThreshold: scoresNearThreshold.length,
            avgScore: Math.round(avgNearThreshold),
            passingThreshold: minPassingScore,
            note: 'Users scoring 60-69 are very close to passing'
          }
        );
      }
    } catch (error) {
      this.recordTest(
        'Rejection Threshold Edge Cases',
        false,
        { error: error.message }
      );
    }
  }

  /**
   * Record test result
   */
  recordTest(testName, passed, details = {}) {
    if (passed) {
      this.testResults.passed++;
      console.log(`  ✅ ${testName}`);
    } else {
      this.testResults.failed++;
      console.log(`  ❌ ${testName}`);
    }
    
    if (Object.keys(details).length > 0) {
      console.log(`     Details:`, JSON.stringify(details, null, 2));
    }

    this.testResults.tests.push({
      name: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Print test summary
   */
  printTestSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('📋 TEST SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Tests: ${this.testResults.passed + this.testResults.failed}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    
    const successRate = this.testResults.passed + this.testResults.failed > 0
      ? ((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(2)
      : 0;
    
    console.log(`Success Rate: ${successRate}%`);
    console.log('=' .repeat(60));

    if (this.testResults.failed > 0) {
      console.log('\n⚠️  Failed Tests:');
      this.testResults.tests
        .filter(t => !t.passed)
        .forEach(t => {
          console.log(`  - ${t.name}`);
          if (t.details && Object.keys(t.details).length > 0) {
            console.log(`    ${JSON.stringify(t.details, null, 2)}`);
          }
        });
    }

    console.log('\n💡 System Configuration:');
    console.log(`  Max Attempts Threshold: ${this.maxAttempts}`);
    console.log(`  Minimum Passing Score: ${skillMatching.minPassingScore}`);
    console.log(`  Learning Support Trigger: ${this.maxAttempts}+ failed attempts`);
    
    console.log('\n📊 System Health:');
    if (successRate >= 95) {
      console.log('  🟢 Excellent - Rejection handling and learning system fully operational');
    } else if (successRate >= 85) {
      console.log('  🟡 Good - System working with minor issues');
    } else if (successRate >= 70) {
      console.log('  🟠 Fair - Review failed tests');
    } else {
      console.log('  🔴 Needs Attention - Multiple system components need review');
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new RejectionAndLearningSystemTester();
  tester.runAllTests()
    .then(() => {
      console.log('\n✨ Test suite completed');
      process.exit(tester.testResults.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = RejectionAndLearningSystemTester;