const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendMail } = require('../utils/email');

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

    // 1. Create database notification
    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type: type || 'general',
    });

    // 2. Fetch User email address and name
    const user = await User.findById(userId);
    if (user && user.email) {
      // 3. Compose a beautifully structured responsive HTML email
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PrepForce AI Update</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 30px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
      border: 1px solid #f1f5f9;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      padding: 35px 24px;
      text-align: center;
    }
    .logo-text {
      color: #ffffff;
      font-size: 26px;
      font-weight: 900;
      letter-spacing: -0.5px;
      margin: 0;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .logo-icon {
      font-size: 28px;
    }
    .content {
      padding: 40px 32px;
      color: #334155;
    }
    .greeting {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .intro {
      font-size: 15px;
      line-height: 1.6;
      color: #64748b;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .notification-card {
      background-color: #fafafa;
      border-left: 4px solid #6366f1;
      padding: 22px;
      border-radius: 0 12px 12px 0;
      margin-bottom: 30px;
      box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);
    }
    .notification-title {
      font-weight: 800;
      font-size: 16px;
      color: #1e293b;
      margin-bottom: 10px;
    }
    .notification-message {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0;
    }
    .action-container {
      text-align: center;
      margin: 30px 0 10px;
    }
    .btn {
      display: inline-block;
      padding: 14px 36px;
      background-color: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      border-radius: 12px;
      box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.25);
      transition: all 0.2s ease-in-out;
    }
    .btn:hover {
      background-color: #4338ca;
    }
    .footer {
      background-color: #f8fafc;
      padding: 28px 24px;
      text-align: center;
      border-top: 1px solid #f1f5f9;
    }
    .footer-copyright {
      font-size: 12px;
      color: #94a3b8;
      margin: 0;
      line-height: 1.5;
    }
    .footer-support {
      font-size: 12px;
      color: #94a3b8;
      margin: 8px 0 0;
    }
    .footer-support a {
      color: #4f46e5;
      text-decoration: none;
      font-weight: 600;
    }
    .footer-support a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h2 class="logo-text">
          <span class="logo-icon">⚡</span> PrepForce AI
        </h2>
      </div>
      <div class="content">
        <h3 class="greeting">Hi ${user.name || 'Student'},</h3>
        <p class="intro">You have received a new notification from the PrepForce AI dashboard. See details below:</p>
        
        <div class="notification-card">
          <div class="notification-title">${title}</div>
          <p class="notification-message">${message.replace(/\n/g, '<br>')}</p>
        </div>

        <p class="intro">Log in to practice mock tests, track your analytics, and continue your daily preparation journey.</p>
        
        <div class="action-container">
          <a href="https://prepforceai.online/dashboard" class="btn" target="_blank">Access Your Dashboard →</a>
        </div>
      </div>
      <div class="footer">
        <p class="footer-copyright">
          © ${new Date().getFullYear()} PrepForce AI · Pakistan's Smart Test Preparation Platform.
        </p>
        <p class="footer-support">
          Have questions? Visit our <a href="https://prepforceai.online/contact-us" target="_blank">Support Center</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
      `;

      try {
        await sendMail(user.email, `PrepForce AI Update: ${title}`, emailHtml);
      } catch (emailErr) {
        console.error('Failed to send notification email:', emailErr.message || emailErr);
        // Do not throw or fail the response if SMTP fails, since the dashboard notification is successfully created.
      }
    }

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
    res.json({ unreadCount: count, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching unread count' });
  }
};
