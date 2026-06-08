// backend/src/controllers/gameController.js
const User = require('../models/User');
const Result = require('../models/Result');

// Update active streak days
exports.trackActivity = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const now = new Date();
    const lastActive = new Date(user.lastActive);

    // Normalize dates to check day differences
    const todayStr = now.toDateString();
    const lastActiveStr = lastActive.toDateString();

    if (todayStr !== lastActiveStr) {
      const diffTime = Math.abs(now - lastActive);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive activity day
        user.streak += 1;
      } else if (diffDays > 1) {
        // Missed days, reset
        user.streak = 1;
      }
      user.lastActive = now;
    }

    // Check achievement unlock conditions
    const testsCount = await Result.countDocuments({ user: user._id });
    
    // First Mock Test unlock
    if (testsCount >= 1 && !user.achievements.includes('First Step')) {
      user.achievements.push('First Step');
    }
    // High Performer unlock (passed with score > 80)
    const passedExcellent = await Result.findOne({ user: user._id, score: { $gte: 80 } });
    if (passedExcellent && !user.achievements.includes('Elite Scholar')) {
      user.achievements.push('Elite Scholar');
    }
    // Streak unlock
    if (user.streak >= 3 && !user.achievements.includes('Consistent Thinker')) {
      user.achievements.push('Consistent Thinker');
    }

    await user.save();
    
    res.json({
      streak: user.streak,
      lastActive: user.lastActive,
      achievements: user.achievements,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating gamification profile' });
  }
};

// Retrieve leaderboard rankings
exports.getLeaderboard = async (req, res) => {
  try {
    // Find top users ordered by average score, tests taken, or simply top results
    const leaderResults = await Result.find()
      .populate('user', 'name desiredExam city')
      .populate('exam', 'title')
      .sort({ score: -1 })
      .limit(10);

    const rankings = leaderResults.map((r, index) => ({
      rank: index + 1,
      name: r.user ? r.user.name : 'Candidate',
      examGoal: r.user ? r.user.desiredExam : 'Exams',
      score: r.score,
      examTitle: r.exam ? r.exam.title : 'Mock Exam',
      city: r.user ? r.user.city : 'General',
    }));

    res.json(rankings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error retrieving leaderboard rankings' });
  }
};
