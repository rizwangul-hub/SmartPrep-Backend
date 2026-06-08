// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

// Looks for token in HttpOnly cookie "token" or Authorization header "Bearer <token>"
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token || (req.headers.authorization || '').split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found, authorization denied' });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ message: 'Access denied: Your account is blocked' });
    }
    req.user = user; // attach full Mongoose user document (includes id, role, desiredExam etc.)
    next();
  } catch (err) {
    console.error('JWT verification error:', err);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = verifyToken;
