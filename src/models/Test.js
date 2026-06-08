// backend/src/models/Test.js
const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title: { type: String, required: true },
  examType: { type: String, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  questions: [{
    text: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctOptionIndex: { type: Number, required: true },
    explanation: { type: String },
    subject: { type: String }
  }],
  duration: { type: Number, required: true }, // in minutes
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Creator or generator
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Test', testSchema);
