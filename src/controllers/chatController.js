const CommunityMessage = require('../models/CommunityMessage');
const User = require('../models/User');
const socketService = require('../services/socketService');

// Fetch paginated community chat messages
exports.getMessages = async (req, res) => {
  try {
    const { before, limit = 50 } = req.query;
    const query = {};
    
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await CommunityMessage.find(query)
      .sort({ createdAt: -1 }) // Fetch newest first to satisfy limit
      .limit(Number(limit))
      .populate('sender', 'name profileImage role')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'name' }
      });

    // Return in chronological order for frontend chat list
    res.json(messages.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching chat messages' });
  }
};

// Fetch pinned announcements
exports.getPinnedMessages = async (req, res) => {
  try {
    const pinned = await CommunityMessage.find({ isPinned: true })
      .populate('sender', 'name profileImage role')
      .sort({ createdAt: -1 });
    res.json(pinned);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching pinned messages' });
  }
};

// Delete an inappropriate message (Admin Only)
exports.deleteMessage = async (req, res) => {
  try {
    const message = await CommunityMessage.findByIdAndDelete(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting message' });
  }
};

// Toggle pin message status (Admin Only)
exports.togglePinMessage = async (req, res) => {
  try {
    const message = await CommunityMessage.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    message.isPinned = !message.isPinned;
    await message.save();

    res.json({
      message: 'Pin status updated successfully',
      isPinned: message.isPinned,
      messageId: message._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating pin status' });
  }
};

// Mute user temporarily (Admin Only)
exports.muteUser = async (req, res) => {
  try {
    const { durationMinutes = 15 } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const muteUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    user.chatMutedUntil = muteUntil;
    await user.save();

    res.json({
      message: `User muted from chat for ${durationMinutes} minutes`,
      chatMutedUntil: muteUntil,
      userId: user._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error muting user' });
  }
};

// Unmute user (Admin Only)
exports.unmuteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.chatMutedUntil = null;
    await user.save();

    res.json({
      message: 'User unmuted successfully',
      userId: user._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error unmuting user' });
  }
};

// Ban / Unban user from chat (Admin Only)
exports.toggleChatBanUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isChatBanned = !user.isChatBanned;
    await user.save();

    res.json({
      message: user.isChatBanned ? 'User banned from community chat' : 'User unbanned from community chat',
      isChatBanned: user.isChatBanned,
      userId: user._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error toggling chat ban' });
  }
};

// Send a message via HTTP POST (serverless fallback)
exports.postMessage = async (req, res) => {
  try {
    const { message, replyTo } = req.body;
    const userId = req.user.id;

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'Message content cannot be empty' });
    }

    // Check user state
    const dbUser = await User.findById(userId);
    if (!dbUser) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (dbUser.status === 'blocked' || dbUser.isChatBanned) {
      return res.status(403).json({ message: 'You are permanently banned from community chat' });
    }

    if (dbUser.chatMutedUntil && dbUser.chatMutedUntil > new Date()) {
      return res.status(403).json({
        message: `You are temporarily muted from chatting until ${dbUser.chatMutedUntil.toLocaleString()}`
      });
    }

    // Rate limiting: Max 10 messages per minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentMsgCount = await CommunityMessage.countDocuments({
      sender: userId,
      createdAt: { $gte: oneMinuteAgo }
    });

    if (recentMsgCount >= 10) {
      return res.status(429).json({
        message: 'Spam Prevention: You can only send up to 10 messages per minute'
      });
    }

    // XSS Sanitization
    const sanitizedMessage = message
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Save message
    let newMsg = await CommunityMessage.create({
      sender: userId,
      message: sanitizedMessage,
      replyTo: replyTo || null
    });

    newMsg = await CommunityMessage.findById(newMsg._id)
      .populate('sender', 'name profileImage role')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'name' }
      });

    // Broadcast to WebSocket clients if socket server is active
    const io = socketService.getIo();
    if (io) {
      io.to('community').emit('messageReceived', newMsg);
    }

    res.status(201).json(newMsg);
  } catch (err) {
    console.error('Error sending HTTP chat message:', err);
    res.status(500).json({ message: 'Server error sending message' });
  }
};
