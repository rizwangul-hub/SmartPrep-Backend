// backend/src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Tracks which Question IDs a user has already seen, per exam type.
// Used to prevent the same question appearing in consecutive tests.
const seenQuestionsEntrySchema = new mongoose.Schema(
  {
    examType: { type: String, required: true },
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  googleId: { type: String },
  gender: { type: String },
  educationLevel: { type: String },
  city: { type: String },
  desiredExam: { type: String },
  streak: { type: Number, default: 0 },
  lastActive: { type: Date, default: Date.now },
  achievements: [{ type: String }],
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  profileImage: { type: String, default: '' },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  forgotPasswordOtp: { type: String },
  forgotPasswordOtpExpire: { type: Date },
  forgotPasswordOtpRequestCount: { type: Number, default: 0 },
  forgotPasswordOtpRequestWindowStart: { type: Date },
  status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  // Per-exam history of seen question IDs (for no-repeat question logic)
  seenQuestions: { type: [seenQuestionsEntrySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

// hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
