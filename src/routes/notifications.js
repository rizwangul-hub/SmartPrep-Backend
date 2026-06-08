// backend/src/routes/notifications.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const verifyToken = require('../middleware/auth');

const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') next();
  else res.status(403).json({ message: 'Access denied: Admin only' });
};

// All notification routes require authentication
router.use(verifyToken);

// Get all notifications for current user
router.get('/', notificationController.getNotifications);

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark all notifications as read (must be BEFORE /:id/read)
router.put('/mark-all-read', notificationController.markAllRead);

// Mark a single notification as read
router.put('/:id/read', notificationController.markRead);

// Admin: create a notification for a user
router.post('/', verifyAdmin, notificationController.createNotification);

// Delete a notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
