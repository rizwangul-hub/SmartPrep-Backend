// backend/src/routes/exams.js
const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const verifyToken = require('../middleware/auth');

// Middleware to ensure user is admin
const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admin only' });
  }
};

// Public routes (or token-protected if you want users to be logged in to view exams)
router.get('/', verifyToken, examController.getExams);
router.get('/:id', verifyToken, examController.getExamById);

// Admin-only routes
router.post('/', verifyToken, verifyAdmin, examController.createExam);
router.put('/:id', verifyToken, verifyAdmin, examController.updateExam);
router.delete('/:id', verifyToken, verifyAdmin, examController.deleteExam);

router.post('/:examId/questions', verifyToken, verifyAdmin, examController.addQuestion);
router.put('/questions/:questionId', verifyToken, verifyAdmin, examController.updateQuestion);
router.delete('/questions/:questionId', verifyToken, verifyAdmin, examController.deleteQuestion);

// Seeding route
router.post('/seed', verifyToken, examController.seedExams);

module.exports = router;
