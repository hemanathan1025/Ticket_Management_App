// Import email tools
const nodemailer = require("nodemailer");

const PLACEHOLDER_EMAIL_VALUES = new Set([
  "your_email@gmail.com",
  "your_email@example.com",
]);

const PLACEHOLDER_PASS_VALUES = new Set([
  "your_email_password",
  "your_app_password",
  "your_16_character_gmail_app_password",
]);

// Check email settings
const isEmailConfigured = () => {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();

  return Boolean(
    user &&
      pass &&
      !PLACEHOLDER_EMAIL_VALUES.has(user.toLowerCase()) &&
      !PLACEHOLDER_PASS_VALUES.has(pass.toLowerCase())
  );
};

// Read email credentials
const getEmailAuth = () => {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();

  if (!isEmailConfigured()) {
    throw new Error(
      "EMAIL_USER and EMAIL_PASS must be set in backend/.env. Use a Gmail App Password for EMAIL_PASS."
    );
  }

  return { user, pass };
};

// Create email transporter
const createTransporter = () => {
  const { user, pass } = getEmailAuth();

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
};

// Send OTP email
const sendEmailOTP = async (email, otp) => {
  const { user } = getEmailAuth();
  const transporter = createTransporter();

  return transporter.sendMail({
    from: `"Ticket Management" <${user}>`,
    to: email,
    subject: "Ticket Management OTP",
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
  });
};

// Export email helpers
module.exports = { isEmailConfigured, sendEmailOTP };
