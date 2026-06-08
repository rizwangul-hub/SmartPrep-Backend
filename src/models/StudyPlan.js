// backend/src/models/StudyPlan.js
const mongoose = require('mongoose');

const studyPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: String, required: true },
  dailyPlan: { type: String },
  weeklyPlan: { type: String },
  monthlyPlan: { type: String },
  weakAreas: [{ type: String }],
  strongAreas: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
