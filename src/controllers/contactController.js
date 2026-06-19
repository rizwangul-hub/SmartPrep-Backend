const ContactMessage = require("../models/ContactMessage");

// Create a new contact message (Public)
exports.createMessage = async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Simple validation
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "Please provide a valid email address" });
  }

  try {
    const newMessage = await ContactMessage.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    });

    res.status(201).json({
      success: true,
      message: "Your message has been sent successfully. We will get back to you soon!",
      data: newMessage,
    });
  } catch (err) {
    console.error("Error saving contact message:", err);
    res.status(500).json({ success: false, message: "Server error, failed to send message" });
  }
};

// Retrieve all contact messages (Admin Only)
exports.getMessages = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const search = req.query.search || "";

    const filter = {};
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { subject: searchRegex },
        { message: searchRegex },
      ];
    }

    const totalCount = await ContactMessage.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    const messages = await ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      success: true,
      messages,
      totalCount,
      totalPages,
      page,
    });
  } catch (err) {
    console.error("Error retrieving contact messages:", err);
    res.status(500).json({ success: false, message: "Server error retrieving messages" });
  }
};
