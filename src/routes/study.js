// backend/src/routes/study.js
const express = require('express');
const router = express.Router();
const studyController = require('../controllers/studyController');
const verifyToken = require('../middleware/auth');

router.use(verifyToken);

router.get('/', studyController.getStudyPlan);
router.post('/regenerate', studyController.regeneratePlan);
router.post('/chat', studyController.chatAssistant);
router.post('/mock-interview', studyController.mockInterview);
router.get('/recommendations', studyController.getRecommendations);

module.exports = router;
