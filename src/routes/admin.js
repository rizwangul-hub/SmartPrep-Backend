// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const verifyToken = require('../middleware/auth');

// Middleware to ensure user is admin
const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admin only' });
  }
};

// All admin routes are protected
router.use(verifyToken);
router.use(verifyAdmin);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// Stats
router.get('/stats', adminController.getDashboardStats);

// User CRUD
router.get('/users', adminController.getUsers);
router.put('/users/:userId/role', adminController.updateUserRole);
router.put('/users/:userId/status', adminController.updateUserStatus);
router.delete('/users/:userId', adminController.deleteUser);

module.exports = router;
