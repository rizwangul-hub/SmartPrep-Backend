// backend/src/controllers/adminController.js
const AdminSettings = require('../models/AdminSettings');
const User = require('../models/User');
const Result = require('../models/Result');
const Exam = require('../models/Exam');

// Get active AI settings (obfuscated keys)
exports.getSettings = async (req, res) => {
  try {
    let settings = await AdminSettings.findOne();
    if (!settings) {
      settings = await AdminSettings.create({
        openrouterKey: '',
        defaultModel: 'google/gemini-2.5-flash',
      });
    }

    const obfuscate = (key) => {
      if (!key) return '';
      if (key.length <= 8) return '****';
      return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    res.json({
      openrouterKeyObfuscated: obfuscate(settings.openrouterKey),
      defaultModel: settings.defaultModel,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error retrieving admin configurations' });
  }
};

// Update settings
exports.updateSettings = async (req, res) => {
  const { openrouterKey, defaultModel } = req.body;
  try {
    let settings = await AdminSettings.findOne();
    if (!settings) {
      settings = new AdminSettings();
    }

    if (defaultModel) settings.defaultModel = defaultModel;
    
    // Only update key if user typed a new one (not obfuscated placeholder)
    if (openrouterKey && !openrouterKey.includes('...')) {
      settings.openrouterKey = openrouterKey;
    }

    settings.updatedAt = Date.now();
    await settings.save();

    res.json({ message: 'AI configuration updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating configs' });
  }
};

// Get high-level analytical stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTests = await Result.countDocuments();
    const totalExams = await Exam.countDocuments();

    // Grouping tests by exam
    const testRuns = await Result.aggregate([
      { $group: { _id: '$exam', count: { $sum: 1 } } }
    ]);

    res.json({
      totalUsers,
      totalTests,
      totalExams,
      testRuns,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching statistics' });
  }
};

// List users for management
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error listing accounts' });
  }
};

// Toggle user role or status
exports.updateUserRole = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User account not found' });
    user.role = role;
    await user.save();
    res.json({ message: `Role updated to ${role} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating user role' });
  }
};

// Delete user account
exports.deleteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await User.findByIdAndDelete(userId);
    res.json({ message: 'User account deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting account' });
  }
};

// Toggle user block status (Admin only)
exports.updateUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body; // status is 'active' or 'blocked'
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User account not found' });
    
    if (status) {
      user.status = status;
      await user.save();
    }
    
    res.json({ message: `User status updated to ${user.status} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating status' });
  }
};
