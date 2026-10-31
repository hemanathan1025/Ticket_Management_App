// Import user model
const mongoose = require("mongoose");

const User = require("../models/User");
const { normalizeRole } = require("../utils/roleUtils");
const { uploadProfileImage } = require("../utils/uploadToCloudinary");

const isMongoConnected = () => mongoose.connection.readyState === 1;

const normalizeText = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

// Build profile response
const buildUserResponse = (user) => {
  const role = normalizeRole(user.role) || user.role || "";
  const phone = normalizeText(user.phone) || normalizeText(user.mobile);

  return {
    id: String(user._id),
    _id: String(user._id),
    name: user.name || "",
    email: user.email || "",
    role,
    phone,
    mobile: user.mobile || phone,
    profileImage: user.profileImage || "",
  };
};

// Find logged-in user
const findAuthenticatedUser = async (req) => {
  const query = [];

  if (req.user?.userId) {
    query.push({ _id: req.user.userId });
  }

  if (req.user?.email) {
    query.push({ email: normalizeText(req.user.email).toLowerCase() });
  }

  if (query.length === 0) {
    return null;
  }

  return User.findOne({ $or: query });
};

// Save profile changes
const updateAuthenticatedUser = async (req, updates) => {
  const query = [];

  if (req.user?.userId) {
    query.push({ _id: req.user.userId });
  }

  if (req.user?.email) {
    query.push({ email: normalizeText(req.user.email).toLowerCase() });
  }

  if (query.length === 0) {
    return null;
  }

  return User.findOneAndUpdate(
    { $or: query },
    { $set: updates },
    { returnDocument: "after", runValidators: true },
  );
};

// Update user profile
const updateProfile = async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({
      success: false,
      message: "Database is not connected",
    });
  }

  try {
    const name = normalizeText(req.body?.name);
    const phone = normalizeText(req.body?.phone);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone must be 10 digits",
      });
    }

    const updates = { name, phone };

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "profileImage")) {
      updates.profileImage = normalizeText(req.body.profileImage);
    }

    console.log("[users] Updating allowed profile fields:", {
      name,
      phone,
      profileImageChanged: Object.prototype.hasOwnProperty.call(
        req.body || {},
        "profileImage",
      ),
      ignoredRole: Object.prototype.hasOwnProperty.call(req.body || {}, "role"),
      ignoredEmail: Object.prototype.hasOwnProperty.call(req.body || {}, "email"),
    });

    // Validate changed fields
    const user = await updateAuthenticatedUser(req, updates);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error("[users] update profile failed", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile",
    });
  }
};

// Update profile image
const updateProfileImage = async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({
      success: false,
      message: "Database is not connected",
    });
  }

  if (!req.file?.buffer) {
    return res.status(400).json({
      success: false,
      message: "Profile image is required",
    });
  }

  try {
    const uploadedImage = await uploadProfileImage(req.file.buffer);
    const user = await updateAuthenticatedUser(req, {
      profileImage: uploadedImage.secure_url,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log("[users] Profile image URL saved:", user.profileImage);

    return res.json({
      success: true,
      message: "Profile image updated",
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error("[users] profile image upload failed", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload profile image",
    });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({
      success: false,
      message: "Database is not connected",
    });
  }

  try {
    const user = await findAuthenticatedUser(req);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error("[users] get profile failed", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load profile",
    });
  }
};

// Get staff users
const getStaffUsers = async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({
      success: false,
      message: "Database is not connected",
    });
  }

  try {
    const staff = await User.find({ role: "staff" })
      .sort({ name: 1, email: 1 })
      .lean();

    return res.json({
      success: true,
      staff: staff.map(buildUserResponse),
    });
  } catch (error) {
    console.error("[users] get staff failed", error.message);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load staff",
    });
  }
};

// Export profile handlers
module.exports = {
  getStaffUsers,
  getProfile,
  updateProfile,
  updateProfileImage,
};
