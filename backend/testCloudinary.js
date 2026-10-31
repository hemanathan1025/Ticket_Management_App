// Load environment settings
require("dotenv").config();

// Import cloud storage
const cloudinary = require("./config/cloudinary");

// Test cloud connection
cloudinary.api
  .ping()
  .then((result) => {
    console.log("Cloudinary Connected:", result);
  })
  .catch((error) => {
    console.log("Cloudinary Error:", {
      message: error.message,
      httpCode: error.http_code,
    });
  });
