// backend/src/models/Achievement.js
const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  badgeIcon: { type: String },
  type: {
    type: String,
    enum: [
      'first_test',
      'streak_3',
      'streak_7',
      'high_scorer',
      'perfect_score',
      'speed_demon',
      'ten_tests',
      'twenty_tests',
    ],
    required: true,
  },
  unlockedAt: { type: Date, default: Date.now },
});

/**
 * Check all achievement criteria for a user and unlock any that are newly met.
 * Returns an array of newly unlocked achievement documents.
 */
achievementSchema.statics.checkAndUnlock = async function (userId) {
  // Import inside static to avoid circular dependencies
  const User = require('./User');
  const Result = require('./Result');

  // Gather user stats
  const [resultCount, highestResult, user, existingAchievements] = await Promise.all([
    Result.countDocuments({ user: userId }),
    Result.findOne({ user: userId }).sort({ score: -1 }).lean(),
    User.findById(userId).lean(),
    this.find({ user: userId }).lean(),
  ]);

  const highestScore = highestResult ? highestResult.score : 0;
  const streak = user ? user.streak || 0 : 0;
  const unlockedTypes = new Set(existingAchievements.map((a) => a.type));

  // Define all achievement criteria
  const definitions = [
    {
      type: 'first_test',
      condition: resultCount >= 1,
      title: 'First Step',
      badgeIcon: '🎯',
      description: 'Completed your first mock test',
    },
    {
      type: 'ten_tests',
      condition: resultCount >= 10,
      title: 'Dedicated Learner',
      badgeIcon: '📚',
      description: 'Completed 10 mock tests',
    },
    {
      type: 'twenty_tests',
      condition: resultCount >= 20,
      title: 'Test Veteran',
      badgeIcon: '🏆',
      description: 'Completed 20 mock tests',
    },
    {
      type: 'high_scorer',
      condition: highestScore >= 80,
      title: 'Elite Scholar',
      badgeIcon: '⭐',
      description: 'Scored 80% or above',
    },
    {
      type: 'perfect_score',
      condition: highestScore === 100,
      title: 'Perfect Mind',
      badgeIcon: '💎',
      description: 'Achieved a perfect score',
    },
    {
      type: 'streak_3',
      condition: streak >= 3,
      title: 'Consistent Thinker',
      badgeIcon: '🔥',
      description: '3-day study streak',
    },
    {
      type: 'streak_7',
      condition: streak >= 7,
      title: 'Week Warrior',
      badgeIcon: '💪',
      description: '7-day study streak',
    },
  ];

  const newlyUnlocked = [];

  for (const def of definitions) {
    if (def.condition && !unlockedTypes.has(def.type)) {
      const achievement = await this.create({
        user: userId,
        type: def.type,
        title: def.title,
        badgeIcon: def.badgeIcon,
        description: def.description,
      });
      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
};

module.exports = mongoose.model('Achievement', achievementSchema);
