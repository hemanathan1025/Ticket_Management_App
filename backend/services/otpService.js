// Import secure randomizer
const { randomInt } = require("crypto");

// Generate six-digit OTP
const generateOTP = () => {
  return randomInt(100000, 1000000).toString();
};

// Export OTP helper
module.exports = { generateOTP };
