// Import authentication tools
const jwt = require("jsonwebtoken");
const { normalizeRole } = require("../utils/roleUtils");

// Read JWT secret
const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    console.warn("[auth] JWT_SECRET is not set. Using development fallback.");
  }

  return process.env.JWT_SECRET || "development-secret-change-me";
};

// Verify authentication token
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is required",
    });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const role = normalizeRole(payload.role);

    if (!role) {
      return res.status(403).json({
        success: false,
        message: "Invalid role in token",
      });
    }

    req.user = {
      ...payload,
      role,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token",
    });
  }
};

// Check allowed roles
const authorizeRoles = (...allowedRoles) => {
  const normalizedAllowedRoles = allowedRoles
    .map(normalizeRole)
    .filter(Boolean);

  return (req, res, next) => {
    if (!req.user?.role || !normalizedAllowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to access this resource",
      });
    }

    return next();
  };
};

// Export authentication middleware
module.exports = {
  authenticate,
  authorizeRoles,
};
