// backend/src/utils/email.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create a transporter using environment-configured SMTP or fallback to Gmail app password
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true' || false,
  auth: {
    user: process.env.EMAIL_USER || process.env.GMAIL_USER,
    pass: process.env.EMAIL_PASS || process.env.GMAIL_PASS,
  },
});

/**
 * Send a simple email.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} html - HTML body content
 */
const sendMail = async (to, subject, html) => {
  const user = process.env.EMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.EMAIL_PASS || process.env.GMAIL_PASS;

  if (!user || !pass) {
    console.log('⚠️ [Email Service] SMTP credentials not set. Mocking email send:');
    console.log(`👉 To: ${to}`);
    console.log(`👉 Subject: ${subject}`);
    console.log(`👉 Body: ${html}`);
    return { mock: true, messageId: 'mock-id' };
  }

  const mailOptions = {
    from: user,
    to,
    subject,
    html,
  };
  return transporter.sendMail(mailOptions);
};

module.exports = { sendMail };
