const mongoose = require("mongoose");

const subjectBreakdownSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    total: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
  },
  { _id: false },
);

const resultSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
  test: { type: mongoose.Schema.Types.ObjectId, ref: "Test" },
  examName: { type: String },
  answers: [
    {
      question: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
      questionIndex: Number,
      selectedOptionIndex: Number,
      isCorrect: Boolean,
      subject: String,
    },
  ],
  score: { type: Number, required: true },
  correctCount: { type: Number, default: 0 },
  incorrectCount: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  subjectBreakdown: [subjectBreakdownSchema],
  weakSubjects: [{ type: String }],
  strongSubjects: [{ type: String }],
  takenAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Result", resultSchema);
