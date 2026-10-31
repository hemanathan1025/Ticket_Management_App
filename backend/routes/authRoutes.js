// Import route tools
const express = require("express");

const {
  sendAuthOtp,
  verifyAuthOtp,
} = require("../controllers/authController");

// Create auth routes
const router = express.Router();

// Send login OTP
router.post("/send-otp", sendAuthOtp);
// Verify login OTP
router.post("/verify-otp", verifyAuthOtp);

// Export auth routes
module.exports = router;
