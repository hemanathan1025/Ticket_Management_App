// Import OTP models
const OTP = require("../models/OTP");
const User = require("../models/User");
const { generateOTP } = require("../services/otpService");
const {
  isEmailConfigured,
  sendEmailOTP,
} = require("../services/emailService");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { normalizeRole } = require("../utils/roleUtils");

const OTP_EXPIRY_MS = 5 * 60 * 1000;
// Store fallback OTPs
const memoryOtpRecords = new Map();

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

// Normalize user credentials
const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const normalizeMobile = (mobile) =>
  typeof mobile === "string" ? mobile.trim() : "";

const normalizePhone = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const getUserPhone = (user) =>
  normalizePhone(user?.phone) || normalizePhone(user?.mobile);

const normalizeUsername = (username) =>
  typeof username === "string" ? username.trim().toLowerCase() : "";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Build credential query
const buildCredentialQuery = ({ email, mobile, username }) => {
  const query = [];

  if (email) {
    query.push({ email });
  }

  if (mobile) {
    query.push({ mobile });
  }

  if (username) {
    query.push({ username });
  }

  return query;
};

const credentialMatches = (record, { email, mobile, username }) =>
  Boolean(
    (email && record.email === email) ||
      (mobile && record.mobile === mobile) ||
      (username && record.username === username)
  );

// Remove stored OTPs
const deleteMemoryOtpRecords = (credentials) => {
  for (const [id, record] of memoryOtpRecords.entries()) {
    if (credentialMatches(record, credentials)) {
      memoryOtpRecords.delete(id);
    }
  }
};

// Store temporary OTP
const createMemoryOtpRecord = (record) => {
  const id = `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const memoryRecord = {
    ...record,
    _id: id,
    createdAt: new Date(),
    _memory: true,
  };

  memoryOtpRecords.set(id, memoryRecord);
  return memoryRecord;
};

// Find temporary OTP
const findMemoryOtpRecord = ({ email, mobile, username, otp }) =>
  Array.from(memoryOtpRecords.values())
    .filter(
      (record) =>
        record.otp === otp && credentialMatches(record, { email, mobile, username })
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;

// Delete verified OTP
const deleteOtpRecord = async (otpRecord) => {
  if (otpRecord?._memory) {
    memoryOtpRecords.delete(otpRecord._id);
    return;
  }

  await OTP.deleteOne({ _id: otpRecord._id });
};

// Log OTP errors
const logOtpError = (action, error, context = {}) => {
  console.error(`[otp] ${action} failed`, {
    ...context,
    message: error.message,
    code: error.code,
    command: error.command,
    response: error.response,
    responseCode: error.responseCode,
  });
};

// Find matching user
const findUserByCredential = async ({ email, mobile, username }) => {
  const query = [];

  if (email) {
    query.push({ email: normalizeEmail(email) });
  }

  if (mobile) {
    query.push({ mobile: normalizeMobile(mobile) });
    query.push({ phone: normalizeMobile(mobile) });
  }

  if (username) {
    const normalizedUsername = normalizeUsername(username);

    query.push({ username: normalizedUsername });
    query.push({
      name: new RegExp(`^${escapeRegex(normalizedUsername)}$`, "i"),
    });
  }

  if (query.length === 0) {
    return null;
  }

  if (!isMongoConnected()) {
    return null;
  }

  return User.findOne({ $or: query }).lean();
};

// Detect legacy role
const inferRoleForLegacyData = ({ email, username }) => {
  const legacyValue = email || username || "";

  if (/^admin(@|$)/i.test(legacyValue)) {
    return "Admin";
  }

  const isSupervisor = /^sup\d+(@|$)/i.test(legacyValue);

  return isSupervisor ? "Supervisor" : "Incharge";
};

// Get user role
const getRoleForCredential = async ({ email, mobile, username }) => {
  const user = await findUserByCredential({ email, mobile, username });
  const dbRole = normalizeRole(user?.role);
  const role = dbRole || inferRoleForLegacyData({ email, username });

  console.log("[auth] Role lookup:", {
    credential: email || mobile || username,
    dbRole: user?.role || null,
    normalizedRole: role,
  });

  return { user, role };
};

// Send OTP
const sendOTP = async (req, res) => {
  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const mobile = normalizeMobile(body.mobile);
  const username = normalizeUsername(body.username);
  let otpRecord = null;

  if (!email && !mobile && !username) {
    return res.status(400).json({
      success: false,
      message: "Email, username, or mobile number is required",
    });
  }

  try {
    const canReturnDevOtp = canExposeDevOtp();
    const { user, role } = await getRoleForCredential({
      email,
      mobile,
      username,
    });
    const recipientEmail = email || normalizeEmail(user?.email);
    const storedMobile = mobile || normalizeMobile(getUserPhone(user));
    const storedUsername =
      username || normalizeUsername(user?.username || user?.name);

    if (username && !user && !email && !mobile && !canReturnDevOtp) {
      return res.status(404).json({
        success: false,
        message: "No account found for this username",
      });
    }

    if (!recipientEmail && !storedMobile && !canReturnDevOtp) {
      return res.status(400).json({
        success: false,
        message: "Email or mobile number is required to send OTP",
      });
    }

    const otp = generateOTP();
    const credentialQuery = buildCredentialQuery({
      email: recipientEmail || email,
      mobile: storedMobile,
      username: storedUsername,
    });

    if (credentialQuery.length > 0) {
      if (isMongoConnected()) {
        await OTP.deleteMany({ $or: credentialQuery });
      } else {
        deleteMemoryOtpRecords({
          email: recipientEmail || email,
          mobile: storedMobile,
          username: storedUsername,
        });
      }
    }

    const otpPayload = {
      mobile: storedMobile,
      email: recipientEmail || email,
      username: storedUsername,
      otp,
      role,
    };

    otpRecord = isMongoConnected()
      ? await OTP.create(otpPayload)
      : createMemoryOtpRecord(otpPayload);

    const canSendEmail = isEmailConfigured();

    if (recipientEmail && canSendEmail) {
      try {
        await sendEmailOTP(recipientEmail, otp);

        console.log("[otp] OTP email sent", {
          email: recipientEmail,
          mobile: storedMobile || null,
          role,
        });
      } catch (error) {
        logOtpError("email send", error, {
          email: recipientEmail,
          mobile: storedMobile,
        });

        if (!canReturnDevOtp) {
          throw error;
        }
      }
    } else if (!canReturnDevOtp) {
      throw new Error(
        "Email service is not configured. Set EMAIL_USER and EMAIL_PASS with a Gmail App Password."
      );
    } else {
      console.warn(
        "[otp] Email is not configured. Returning devOtp because this is a non-production run."
      );
    }

    const responseBody = {
      success: true,
      message: "OTP sent",
    };

    if (canReturnDevOtp) {
      responseBody.devOtp = otp;
    }

    return res.json(responseBody);
  } catch (error) {
    if (otpRecord?._id) {
      await deleteOtpRecord(otpRecord).catch((cleanupError) => {
        logOtpError("cleanup after send failure", cleanupError, {
          otpId: otpRecord._id,
        });
      });
    }

    logOtpError("send", error, { email, mobile, username });

    return res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  const body = req.body || {};
  const email = normalizeEmail(body.email);
  const mobile = normalizeMobile(body.mobile);
  const username = normalizeUsername(body.username);
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";

  if (!otp) {
    return res.status(400).json({
      success: false,
      message: "OTP is required",
    });
  }

  const credentialQuery = buildCredentialQuery({ email, mobile, username });

  if (credentialQuery.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Email, username, or mobile number is required",
    });
  }

  try {
    const otpRecord = isMongoConnected()
      ? await OTP.findOne({
          otp,
          $or: credentialQuery,
        }).sort({ createdAt: -1 })
      : findMemoryOtpRecord({ otp, email, mobile, username });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const createdAt = otpRecord.createdAt?.getTime?.() || 0;

    if (!createdAt || Date.now() - createdAt > OTP_EXPIRY_MS) {
      await deleteOtpRecord(otpRecord);

      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    const { user, role: currentRole } = await getRoleForCredential({
      email: email || otpRecord.email,
      mobile: mobile || otpRecord.mobile,
      username: username || otpRecord.username,
    });
    const role = normalizeRole(otpRecord.role) || currentRole;

    if (!role) {
      return res.status(403).json({
        success: false,
        message: "No valid role found for this account",
      });
    }

    const tokenEmail = otpRecord.email || email || user?.email || null;
    const tokenPhone = otpRecord.mobile || mobile || getUserPhone(user) || null;
    const tokenMobile = user?.mobile || tokenPhone;
    const tokenUsername =
      otpRecord.username || username || user?.username || user?.name || null;
    const tokenName = user?.name || tokenUsername || tokenEmail || tokenPhone || null;
    const tokenProfileImage = user?.profileImage || "";
    console.log("[auth] OTP verified:", {
      credential: email || mobile || username,
      otpRecordRole: otpRecord.role || null,
      userRole: user?.role || null,
      role,
    });

    await deleteOtpRecord(otpRecord);

    const token = jwt.sign(
      {
        userId: user?._id || null,
        email: tokenEmail,
        mobile: tokenMobile,
        phone: tokenPhone,
        username: tokenUsername,
        name: tokenName,
        profileImage: tokenProfileImage,
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
      user: {
        id: user?._id || null,
        email: tokenEmail,
        mobile: tokenMobile,
        phone: tokenPhone,
        username: tokenUsername,
        name: tokenName,
        profileImage: tokenProfileImage,
        role,
      },
    });
  } catch (error) {
    logOtpError("verify", error, { email, mobile, username });

    return res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
};

// Export OTP handlers
module.exports = {
  sendOTP,
  verifyOTP,
};
