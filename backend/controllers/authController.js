// Import authentication tools
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const OTP = require("../models/OTP");
const User = require("../models/User");
const { isEmailConfigured, sendEmailOTP } = require("../services/emailService");
const { generateOTP } = require("../services/otpService");
const { normalizeRole } = require("../utils/roleUtils");

const OTP_EXPIRY_MS = 5 * 60 * 1000;

// Map role dashboards
const ROLE_ROUTES = {
  admin: "/Admin/dashboard",
  supervisor: "/Supervisor/dashboard",
  incharge: "/Incharge/dashboard",
};

const canExposeDevOtp = () =>
  process.env.EXPOSE_DEV_OTP === "true" || process.env.NODE_ENV !== "production";

const isMongoConnected = () => mongoose.connection.readyState === 1;

// Read JWT secret
const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    console.warn("[auth] JWT_SECRET is not set. Using development fallback.");
  }

  return process.env.JWT_SECRET || "development-secret-change-me";
};

// Normalize login email
const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const normalizePhone = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const getUserPhone = (user) =>
  normalizePhone(user?.phone) || normalizePhone(user?.mobile);

// Build user response
const buildUserResponse = (user, role) => ({
  id: String(user._id),
  _id: String(user._id),
  name: user.name || "",
  email: user.email || "",
  mobile: user.mobile || getUserPhone(user),
  phone: getUserPhone(user),
  profileImage: user.profileImage || "",
  role,
});

// Find user account
const findUserByEmail = async (email) => {
  if (!isMongoConnected()) {
    const error = new Error("Database is not connected");
    error.statusCode = 503;
    throw error;
  }

  return User.findOne({ email }).lean();
};

// Send login OTP
const sendAuthOtp = async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "A valid email is required",
    });
  }

  try {
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found for this email",
      });
    }

    const role = normalizeRole(user.role);

    if (!role) {
      return res.status(403).json({
        success: false,
        message: "User role is not configured correctly",
      });
    }

    if (!ROLE_ROUTES[role]) {
      return res.status(403).json({
        success: false,
        message: "This account does not have app dashboard access",
      });
    }

    const otp = generateOTP();

    await OTP.deleteMany({ email });
    await OTP.create({
      email,
      otp,
      role,
    });

    const canSendEmail = isEmailConfigured();
    const responseBody = {
      success: true,
      message: "OTP sent to email",
    };

    if (canSendEmail) {
      await sendEmailOTP(email, otp);
    } else if (canExposeDevOtp()) {
      console.warn("[auth] Email is not configured. Returning devOtp in development.");
      responseBody.devOtp = otp;
    } else {
      return res.status(500).json({
        success: false,
        message: "Email service is not configured",
      });
    }

    return res.json(responseBody);
  } catch (error) {
    console.error("[auth] send otp failed", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to send OTP",
    });
  }
};

// Verify login OTP
const verifyAuthOtp = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "A valid email is required",
    });
  }

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      message: "A valid 6-digit OTP is required",
    });
  }

  try {
    if (!isMongoConnected()) {
      return res.status(503).json({
        success: false,
        message: "Database is not connected",
      });
    }

    const otpRecord = await OTP.findOne({ email, otp }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const createdAt = otpRecord.createdAt?.getTime?.() || 0;

    if (!createdAt || Date.now() - createdAt > OTP_EXPIRY_MS) {
      await OTP.deleteOne({ _id: otpRecord._id });

      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    const user = await findUserByEmail(email);

    if (!user) {
      await OTP.deleteOne({ _id: otpRecord._id });

      return res.status(404).json({
        success: false,
        message: "No account found for this email",
      });
    }

    const role = normalizeRole(user.role);

    if (!role) {
      return res.status(403).json({
        success: false,
        message: "User role is not configured correctly",
      });
    }

    if (!ROLE_ROUTES[role]) {
      return res.status(403).json({
        success: false,
        message: "This account does not have app dashboard access",
      });
    }

    await OTP.deleteOne({ _id: otpRecord._id });

    const phone = getUserPhone(user);
    const token = jwt.sign(
      {
        userId: String(user._id),
        name: user.name || "",
        email: user.email,
        mobile: user.mobile || phone,
        phone,
        profileImage: user.profileImage || "",
        role,
      },
      getJwtSecret(),
      { expiresIn: "1d" }
    );

    return res.json({
      success: true,
      message: "OTP verified",
      role,
      token,
      user: buildUserResponse(user, role),
      redirectTo: ROLE_ROUTES[role],
    });
  } catch (error) {
    console.error("[auth] verify otp failed", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to verify OTP",
    });
  }
};

// Export auth handlers
module.exports = {
  sendAuthOtp,
  verifyAuthOtp,
};
