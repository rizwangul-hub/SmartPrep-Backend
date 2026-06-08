// backend/src/routes/gamification.js
const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const verifyToken = require('../middleware/auth');

router.use(verifyToken);

router.post('/active', gameController.trackActivity);
router.get('/leaderboard', gameController.getLeaderboard);

module.exports = router;
