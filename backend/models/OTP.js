// Import MongoDB tools
const mongoose = require("mongoose");

// Define OTP fields
const otpSchema = new mongoose.Schema({
  mobile: String,
  email: {
    type: String,
    lowercase: true,
    trim: true,
    index: true,
  },
  username: String,
  otp: String,
  role: {
    type: String,
    lowercase: true,
    trim: true,
    enum: ["admin", "supervisor", "incharge"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300,
  },
});

// Export OTP model
module.exports = mongoose.model("OTP", otpSchema);
