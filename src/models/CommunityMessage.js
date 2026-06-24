const mongoose = require('mongoose');

const communityMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityMessage', default: null },
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 604800 } // 7 days in seconds
});

// Create text index on the message field for search functionality
communityMessageSchema.index({ message: 'text' });

module.exports = mongoose.model('CommunityMessage', communityMessageSchema);
