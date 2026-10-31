// Import route tools
const express = require("express");
// Create OTP routes
const router = express.Router();

const { sendOTP, verifyOTP } = require("../controllers/otpController");

// Send OTP
router.post("/send", sendOTP);
// Verify OTP
router.post("/verify", verifyOTP);

// Export OTP routes
module.exports = router;
