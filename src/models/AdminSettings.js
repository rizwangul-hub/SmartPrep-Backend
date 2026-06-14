// backend/src/models/AdminSettings.js
const mongoose = require('mongoose');

const adminSettingsSchema = new mongoose.Schema({
  aiProvider: { type: String, default: 'openrouter' },
  geminiKey: { type: String, default: '' },
  openaiKey: { type: String, default: '' },
  openrouterKey: { type: String, default: '' },
  defaultModel: { type: String, default: 'mistralai/mistral-7b-instruct:free' },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AdminSettings', adminSettingsSchema);
