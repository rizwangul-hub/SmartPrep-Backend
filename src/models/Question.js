// backend/src/models/Question.js
const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
  examName: { type: String, index: true },
  subject: { type: String, required: true, default: "General Knowledge" },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "medium",
  },
  tags: [{ type: String }],
  explanation: { type: String, default: "" },
  source: { type: String, default: "bank" },
  text: { type: String, required: true },
  options: [{ type: String, required: true }], // array of choices
  correctOptionIndex: { type: Number, required: true }, // index of correct option
  type: { type: String, enum: ["single", "multiple"], default: "single" },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

questionSchema.index({ text: 1, subject: 1, examName: 1 }, { unique: false });

module.exports = mongoose.model("Question", questionSchema);
