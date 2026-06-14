// backend/src/controllers/authController.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sendMail } = require('../utils/email');
const cloudinary = require('../config/cloudinary');
require('dotenv').config();

// Helper to upload profile images to Cloudinary
const uploadStream = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'smartprep_profiles' },
      (error, result) => {
        if (result) resolve(result);
        else reject(error);
      }
    );
    stream.write(fileBuffer);
    stream.end();
  });
};

// Helper to generate JWT
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
};

// OTP / reset password helpers
const OTP_REQUEST_LIMIT = 3;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const OTP_EXPIRE_MS = 10 * 60 * 1000; // 10 minutes

const generateNumericOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const hashOtp = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
};

const compareOtp = (otp, hash) => {
  return bcrypt.compare(otp, hash);
};

// @desc   Register new user
// @route  POST /api/auth/register
// @access Public
exports.register = async (req, res) => {
  const { name, fullName, email, password, gender, educationLevel, city, desiredExam } = req.body;
  const finalName = fullName || name;
  try {
    // Check existing user
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    let profileImageUrl = '';
    if (req.file) {
      try {
        const uploadResult = await uploadStream(req.file.buffer);
        profileImageUrl = uploadResult.secure_url;
      } catch (uploadErr) {
        console.error('Registration avatar upload failed:', uploadErr);
      }
    }
    // Create user and mark as verified (skip email verification)
    const user = await User.create({
      name: finalName,
      email,
      password,
      gender,
      educationLevel,
      city,
      desiredExam,
      profileImage: profileImageUrl,
      isVerified: true,
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc   Verify email token
// @route  GET /api/auth/verify/:token
// @access Public
exports.verifyEmail = async (req, res) => {
  const { token } = req.params;
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) return res.status(400).json({ message: 'Invalid token' });
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc   Login user
// @route  POST /api/auth/login
// @access Public
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    if (user.status === 'blocked') return res.status(403).json({ message: 'Access denied: Your account is blocked' });
    // Email verification not required in this deployment; allow login even if not verified
    const token = generateToken(user);
    // Update lastActive streak on login
    user.lastActive = new Date();
    await user.save();
    res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender,
        educationLevel: user.educationLevel,
        city: user.city,
        desiredExam: user.desiredExam,
        streak: user.streak,
        achievements: user.achievements,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc   Forgot password – send OTP to email
// @route  POST /api/auth/forgot-password
// @access Public
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const now = Date.now();
    const windowStart = user.forgotPasswordOtpRequestWindowStart
      ? new Date(user.forgotPasswordOtpRequestWindowStart).getTime()
      : 0;

    if (windowStart && now - windowStart < OTP_REQUEST_WINDOW_MS) {
      if ((user.forgotPasswordOtpRequestCount || 0) >= OTP_REQUEST_LIMIT) {
        return res.status(429).json({
          success: false,
          message: 'Too many OTP requests. Try again later.',
        });
      }
      user.forgotPasswordOtpRequestCount = (user.forgotPasswordOtpRequestCount || 0) + 1;
    } else {
      user.forgotPasswordOtpRequestCount = 1;
      user.forgotPasswordOtpRequestWindowStart = new Date(now);
    }

    const otp = generateNumericOtp();
    user.forgotPasswordOtp = await hashOtp(otp);
    user.forgotPasswordOtpExpire = new Date(now + OTP_EXPIRE_MS);
    await user.save();

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#f9fafb;border-radius:12px;">
        <h2 style="color:#4f46e5;">SMARTPREPAI Password Reset OTP</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Your password reset OTP is:</p>
        <p style="font-size:28px;font-weight:bold;margin:16px 0;letter-spacing:3px;color:#111;">${otp}</p>
        <p>This OTP expires in <strong>10 minutes</strong>.</p>
        <p>If you did not request a password reset, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#9ca3af;font-size:12px;">SMARTPREPAI — AI-Powered Exam Preparation</p>
      </div>
    `;

    await sendMail(email, 'SMARTPREPAI Password Reset OTP', html);
    return res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc   Verify reset OTP
// @route  POST /api/auth/verify-otp
// @access Public
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !user.forgotPasswordOtp || !user.forgotPasswordOtpExpire) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (new Date(user.forgotPasswordOtpExpire).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP Expired' });
    }

    const isMatch = await compareOtp(otp.toString(), user.forgotPasswordOtp);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc   Reset password using OTP
// @route  POST /api/auth/reset-password
// @access Public
exports.resetPasswordWithOtp = async (req, res) => {
  const { email, otp, password, confirmPassword } = req.body;
  if (!email || !otp || !password || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !user.forgotPasswordOtp || !user.forgotPasswordOtpExpire) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (new Date(user.forgotPasswordOtpExpire).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP Expired' });
    }

    const isMatch = await compareOtp(otp.toString(), user.forgotPasswordOtp);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    user.password = password;
    user.forgotPasswordOtp = undefined;
    user.forgotPasswordOtpExpire = undefined;
    user.forgotPasswordOtpRequestCount = 0;
    user.forgotPasswordOtpRequestWindowStart = undefined;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset password with OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc   Reset password using token
// @route  POST /api/auth/reset/:token
// @access Public
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });
    user.password = newPassword; // pre-save hook will hash
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Google OAuth callback logic
exports.googleCallback = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=Google auth failed`);
    }
    const token = generateToken(user);
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      gender: user.gender,
      educationLevel: user.educationLevel,
      city: user.city,
      desiredExam: user.desiredExam,
      streak: user.streak,
      achievements: user.achievements,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      profileImage: user.profileImage,
    };
    res.redirect(`${(process.env.FRONTEND_URL || 'http://localhost:5173').trim()}/login?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=Server error`);
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  const { name, city, gender, educationLevel, desiredExam, profileImage } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (city) user.city = city;
    if (gender) user.gender = gender;
    if (educationLevel) user.educationLevel = educationLevel;
    if (desiredExam) user.desiredExam = desiredExam;
    if (profileImage !== undefined) user.profileImage = profileImage;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        gender: user.gender,
        educationLevel: user.educationLevel,
        city: user.city,
        desiredExam: user.desiredExam,
        streak: user.streak,
        achievements: user.achievements,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        profileImage: user.profileImage,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating profile' });
  }
};

// Toggle bookmark for a question
exports.toggleBookmark = async (req, res) => {
  const { questionId } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const index = user.bookmarks.indexOf(questionId);
    if (index === -1) {
      user.bookmarks.push(questionId);
      await user.save();
      return res.json({ message: 'Question bookmarked', bookmarks: user.bookmarks });
    } else {
      user.bookmarks.splice(index, 1);
      await user.save();
      return res.json({ message: 'Bookmark removed', bookmarks: user.bookmarks });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error toggling bookmark' });
  }
};

// Get bookmarked questions
exports.getBookmarks = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('bookmarks');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.bookmarks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching bookmarks' });
  }
};
