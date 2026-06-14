// backend/src/models/ClassificationCache.js
const mongoose = require("mongoose");

const classificationCacheSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  subject: {
    type: String,
    required: true,
  },
  exam: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-delete cache records after 30 days to save DB space
classificationCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("ClassificationCache", classificationCacheSchema);
