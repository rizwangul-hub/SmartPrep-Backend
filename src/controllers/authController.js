// backend/src/controllers/authController.js
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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

// @desc   Forgot password – send reset link
// @route  POST /api/auth/forgot
// @access Public
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json({ message: 'If that email exists, a reset link will be sent' });
    // Create reset token valid for 1 hour
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 60 * 60 * 1000;
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = expires;
    await user.save();
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset/${resetToken}`;
    const html = `<p>Hello,</p><p>Reset your password by clicking <a href="${resetUrl}">here</a>. This link expires in 1 hour.</p>`;
    await sendMail(email, 'SmartPrep AI – Password Reset', html);
    res.json({ message: 'If that email exists, a reset link will be sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
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
