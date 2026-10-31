// Import MongoDB tools
const mongoose = require("mongoose");

// Define user fields
const userSchema = new mongoose.Schema(
  {
    name: String,
    username: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
      set: (value) =>
        typeof value === "string" ? value.trim().toLowerCase() : value,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    mobile: {
      type: String,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    profileImage: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      lowercase: true,
      trim: true,
      enum: ["admin", "supervisor", "incharge", "staff"],
      required: true,
    },
  },
  { timestamps: true }
);

// Export user model
module.exports = mongoose.model("User", userSchema, "users");
