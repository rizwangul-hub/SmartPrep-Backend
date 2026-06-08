// backend/src/utils/email.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter using Gmail SMTP (app password recommended)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

/**
 * Send a simple email.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML body content
 */
const sendMail = async (to, subject, html) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.log('⚠️ [Email Service] Gmail credentials not set. Mocking email send:');
    console.log(`👉 To: ${to}`);
    console.log(`👉 Subject: ${subject}`);
    console.log(`👉 Body: ${html}`);
    return { mock: true, messageId: 'mock-id' };
  }
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to,
    subject,
    html,
  };
  return transporter.sendMail(mailOptions);
};

module.exports = { sendMail };
