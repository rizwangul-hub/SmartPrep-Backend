// backend/src/models/Exam.js
const mongoose = require("mongoose");

const examSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  duration: { type: Number, required: true }, // minutes
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
  questionDistribution: [
    {
      subject: { type: String, required: true },
      count: { type: Number, default: 1 },
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        default: "medium",
      },
      tags: [{ type: String }],
    },
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Exam", examSchema);
