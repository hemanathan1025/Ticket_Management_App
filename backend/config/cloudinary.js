// Import path tools
const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});

// Import cloud storage
const cloudinary = require("cloudinary").v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

// Validate cloud settings
const validateCloudinaryConfig = () => {
  const missing = [];

  if (!cloudName) missing.push("CLOUDINARY_CLOUD_NAME");
  if (!apiKey) missing.push("CLOUDINARY_API_KEY");
  if (!apiSecret) missing.push("CLOUDINARY_API_SECRET");

  if (missing.length > 0) {
    throw new Error(`Missing Cloudinary variables: ${missing.join(", ")}`);
  }
};

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

console.log("[cloudinary] Configuration:", {
  cloudName: cloudName || "missing",
  apiKey: apiKey || "missing",
  apiSecretExists: Boolean(apiSecret),
});

// Export cloud storage
module.exports = cloudinary;
module.exports.cloudinary = cloudinary;
module.exports.validateCloudinaryConfig = validateCloudinaryConfig;
