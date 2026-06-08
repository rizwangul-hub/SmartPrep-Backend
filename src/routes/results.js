// backend/src/routes/results.js
const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const verifyToken = require('../middleware/auth');

// All result routes require user to be authenticated
router.use(verifyToken);

// Submit new test answers
router.post('/submit', resultController.submitExam);
router.post('/submit-test', resultController.submitGeneratedTest);

// Get historical results of current user
router.get('/my-results', resultController.getUserResults);

// Get single result details by ID
router.get('/:id', resultController.getResultById);

// AI-powered analysis for a specific result
router.get('/:id/analysis', resultController.getResultAnalysis);

module.exports = router;
