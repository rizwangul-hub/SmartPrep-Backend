// backend/src/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const crypto = require('crypto');
require('dotenv').config();

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:5000').trim();

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // Must be ABSOLUTE URL — Google validates against the exact URI
        // registered in Google Cloud Console under "Authorized redirect URIs"
        callbackURL: `${BACKEND_URL}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          let user = await User.findOne({ email });

          if (user) {
            // Link Google ID to existing local account if not already linked
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
          } else {
            // Create a new user for first-time Google sign-in
            user = await User.create({
              name: profile.displayName,
              email,
              password: crypto.randomBytes(20).toString('hex'), // random placeholder
              role: 'user',
              isVerified: true,
              googleId: profile.id,
              profileImage: profile.photos?.[0]?.value || '',
            });
          }
          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  console.warn('Google OAuth not configured — skipping GoogleStrategy registration');
}


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
