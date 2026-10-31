// Map supported roles
const ROLE_ALIASES = {
  supervisor: "supervisor",
  incharge: "incharge",
  "in-charge": "incharge",
  admin: "admin",
  staff: "staff",
};

// Normalize user role
const normalizeRole = (role) => {
  if (!role || typeof role !== "string") {
    return null;
  }

  return ROLE_ALIASES[role.trim().toLowerCase()] || null;
};

// Export role helper
module.exports = {
  normalizeRole,
};
