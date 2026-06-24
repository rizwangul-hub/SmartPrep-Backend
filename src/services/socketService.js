const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CommunityMessage = require('../models/CommunityMessage');

// In-memory session store mapping userId -> Set of socketIds (handles multiple tabs per user)
const onlineUsers = new Map();

module.exports = {
  init: (io) => {
    // Auth middleware: Extract and verify JWT before allowing connection
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
        if (!token) {
          return next(new Error('Authentication error: Token is required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
          return next(new Error('Authentication error: User not found'));
        }

        if (user.status === 'blocked') {
          return next(new Error('Authentication error: Account is blocked'));
        }

        socket.user = user;
        next();
      } catch (err) {
        console.error('Socket authentication failed:', err);
        return next(new Error('Authentication failed: Invalid credentials'));
      }
    });

    io.on('connection', (socket) => {
      const user = socket.user;
      const userId = user._id.toString();

      // Track connection
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);

      // Broadcast new online user count
      io.emit('onlineCount', onlineUsers.size);

      // Automatically join the public community chatroom
      socket.join('community');

      // Handler: Message dispatching
      socket.on('sendMessage', async (data, callback) => {
        try {
          const { message, replyTo } = data;
          if (!message || message.trim() === '') {
            return callback({ success: false, error: 'Message content cannot be empty' });
          }

          // Re-fetch user from DB to check current moderation state
          const dbUser = await User.findById(userId);
          if (!dbUser) {
            return callback({ success: false, error: 'User account not found' });
          }

          if (dbUser.status === 'blocked' || dbUser.isChatBanned) {
            return callback({ success: false, error: 'You are permanently banned from community chat' });
          }

          if (dbUser.chatMutedUntil && dbUser.chatMutedUntil > new Date()) {
            return callback({
              success: false,
              error: `You are temporarily muted from chatting until ${dbUser.chatMutedUntil.toLocaleString()}`
            });
          }

          // Rate Limiter: Max 10 messages per minute per user
          const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
          const recentMsgCount = await CommunityMessage.countDocuments({
            sender: userId,
            createdAt: { $gte: oneMinuteAgo }
          });

          if (recentMsgCount >= 10) {
            return callback({
              success: false,
              error: 'Spam Prevention: You can only send up to 10 messages per minute'
            });
          }

          // XSS / HTML Injection Sanitization
          const sanitizedMessage = message
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

          // Create message in database
          let newMsg = await CommunityMessage.create({
            sender: userId,
            message: sanitizedMessage,
            replyTo: replyTo || null
          });

          // Fetch full populated payload
          newMsg = await CommunityMessage.findById(newMsg._id)
            .populate('sender', 'name profileImage role')
            .populate({
              path: 'replyTo',
              populate: { path: 'sender', select: 'name' }
            });

          // Broadcast real-time message to everyone in room
          io.to('community').emit('messageReceived', newMsg);
          callback({ success: true, message: newMsg });
        } catch (err) {
          console.error('Error processing community message socket event:', err);
          callback({ success: false, error: 'Internal Server Error dispatching message' });
        }
      });

      // Handler: Typing states
      socket.on('typing', (isTyping) => {
        socket.to('community').emit('userTyping', {
          userId,
          name: user.name,
          isTyping
        });
      });

      // Handler: Admin broadcast synchronization (e.g. deletion sync, pin updates)
      socket.on('adminAction', (data) => {
        if (socket.user?.role !== 'admin') return;
        const { action, payload } = data;
        io.to('community').emit('adminActionTriggered', { action, payload });
      });

      // Handler: Disconnect session cleanup
      socket.on('disconnect', () => {
        if (onlineUsers.has(userId)) {
          onlineUsers.get(userId).delete(socket.id);
          if (onlineUsers.get(userId).size === 0) {
            onlineUsers.delete(userId);
          }
        }
        io.emit('onlineCount', onlineUsers.size);
      });
    });
  }
};
