// backend/src/routes/auth.js
const express = require('express');
const passport = require('passport');
const multer = require('multer');
const { 
  register, 
  login, 
  verifyEmail, 
  forgotPassword, 
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

// Request password reset (sends email with token)
router.post('/forgot-password', forgotPassword);

// Reset password using token
router.post('/reset-password/:token', resetPassword);

// Google OAuth Login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth Callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  googleCallback
);

// Protected routes
router.put('/profile', verifyToken, updateProfile);
router.post('/bookmarks/toggle', verifyToken, toggleBookmark);
router.get('/bookmarks', verifyToken, getBookmarks);

module.exports = router;
