// backend/src/controllers/notificationController.js
const Notification = require('../models/Notification');

// Get all notifications for the logged-in user, sorted newest first
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching notifications' });
  }
};

// Mark a specific notification as read by its ID
exports.markRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error marking notification as read' });
  }
};

// Mark all notifications for user as read
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error marking all notifications as read' });
  }
};

// Admin creates a notification for a specific user
exports.createNotification = async (req, res) => {
  const { userId, title, message, type } = req.body;
  try {
    if (!userId || !title || !message) {
      return res.status(400).json({ message: 'userId, title, and message are required' });
    }

    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type: type || 'general',
    });

    res.status(201).json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating notification' });
  }
};

// Delete a notification by ID
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting notification' });
  }
};

// Returns count of unread notifications for user
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user.id,
      read: false,
    });
    res.json({ unreadCount: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching unread count' });
  }
};
