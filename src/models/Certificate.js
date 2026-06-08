// backend/src/models/Certificate.js
const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  examTitle: { type: String, required: true },
  score: { type: Number, required: true },
  certificateCode: { type: String, required: true, unique: true },
  issuedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Certificate', certificateSchema);
