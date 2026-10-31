// Import MongoDB tools
const mongoose = require("mongoose");

// Define counter fields
const counterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 100,
    },
  },
  {
    versionKey: false,
  }
);

// Export counter model
module.exports = mongoose.model("Counter", counterSchema);
