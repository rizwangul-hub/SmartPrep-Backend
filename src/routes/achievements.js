// backend/src/routes/achievements.js
const express = require('express');
const router = express.Router();
const achievementController = require('../controllers/achievementController');
const verifyToken = require('../middleware/auth');

// All achievement routes require authentication
router.use(verifyToken);

// Get all achievements for current user
router.get('/', achievementController.getMyAchievements);

// Trigger achievement check and unlock
router.post('/check', achievementController.checkUnlocks);

module.exports = router;
