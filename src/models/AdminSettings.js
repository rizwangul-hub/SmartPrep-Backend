// backend/src/models/AdminSettings.js
const mongoose = require('mongoose');

const adminSettingsSchema = new mongoose.Schema({
  openrouterKey: { type: String, default: '' },
  defaultModel: { type: String, default: 'google/gemini-2.5-flash' },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AdminSettings', adminSettingsSchema);
