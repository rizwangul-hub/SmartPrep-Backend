// backend/src/routes/auth.js
const express = require('express');
const passport = require('passport');
const multer = require('multer');
const { 
  register, 
  login, 
  verifyEmail, 
  forgotPassword, 
  verifyOtp, 
  resetPasswordWithOtp,
  resetPassword, 
  googleCallback,
  updateProfile,
  toggleBookmark,
  getBookmarks
} = require('../controllers/authController');
const verifyToken = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Register new user
router.post('/register', upload.single('profileImage'), register);

// Login
router.post('/login', login);

// Email verification (link sent via Gmail)
router.get('/verify/:token', verifyEmail);

// Request password reset (sends OTP to email)
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPasswordWithOtp);

// Reset password using token
router.post('/reset-password/:token', resetPassword);

// Google OAuth Login
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  }),
);

// Google OAuth Callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  googleCallback,
);

// Protected routes
router.get('/me', verifyToken, (req, res) => {
  res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    gender: req.user.gender,
    educationLevel: req.user.educationLevel,
    city: req.user.city,
    desiredExam: req.user.desiredExam,
    streak: req.user.streak,
    achievements: req.user.achievements,
    isVerified: req.user.isVerified,
    createdAt: req.user.createdAt,
    profileImage: req.user.profileImage,
  });
});
router.put('/profile', verifyToken, updateProfile);
router.post('/bookmarks/toggle', verifyToken, toggleBookmark);
router.get('/bookmarks', verifyToken, getBookmarks);

module.exports = router;
