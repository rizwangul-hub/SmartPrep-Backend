const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const verifyToken = require('../middleware/auth');

const verifyAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') next();
  else res.status(403).json({ message: 'Access denied: Admin only' });
};

// All community chat routes require token verification
router.use(verifyToken);

// Fetch paginated community messages
router.get('/messages', chatController.getMessages);

// Fetch pinned messages
router.get('/pinned', chatController.getPinnedMessages);

// Admin moderation actions
router.delete('/messages/:id', verifyAdmin, chatController.deleteMessage);
router.put('/messages/:id/pin', verifyAdmin, chatController.togglePinMessage);
router.post('/users/:id/mute', verifyAdmin, chatController.muteUser);
router.post('/users/:id/unmute', verifyAdmin, chatController.unmuteUser);
router.post('/users/:id/ban', verifyAdmin, chatController.toggleChatBanUser);

module.exports = router;
