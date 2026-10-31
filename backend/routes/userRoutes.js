// Import route tools
const express = require("express");

const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");
const {
  getStaffUsers,
  getProfile,
  updateProfile,
  updateProfileImage,
} = require("../controllers/userController");
const { uploadImage } = require("../middleware/upload");

// Create profile routes
const router = express.Router();

// Get staff users
router.get("/staff", authenticate, authorizeRoles("admin", "incharge"), getStaffUsers);
// Get user profile
router.get("/profile", authenticate, getProfile);
// Update user profile
router.put("/profile", authenticate, updateProfile);
// Upload profile image
router.put(
  "/profile/image",
  authenticate,
  uploadImage("image"),
  updateProfileImage
);

// Export profile routes
module.exports = router;
