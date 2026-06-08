// backend/src/controllers/achievementController.js
const Achievement = require('../models/Achievement');

// Returns all achievements for current user
exports.getMyAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.find({ user: req.user.id })
      .sort({ unlockedAt: -1 });
    res.json(achievements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching achievements' });
  }
};

// Check and unlock any new achievements, return newly unlocked + all
exports.checkUnlocks = async (req, res) => {
  try {
    const newlyUnlocked = await Achievement.checkAndUnlock(req.user.id);
    const allAchievements = await Achievement.find({ user: req.user.id })
      .sort({ unlockedAt: -1 });

    res.json({
      newlyUnlocked,
      achievements: allAchievements,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error checking achievements' });
  }
};
