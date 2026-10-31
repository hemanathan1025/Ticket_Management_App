// Import MongoDB tools
const mongoose = require("mongoose");

// Define chat messages
const ticketMessageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    author: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Define ticket fields
const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      required: true,
    },
    issueType: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    staffId: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    staffName: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["new", "active", "resolved", "closed"],
      default: "new",
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
    createdById: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    assignedTo: {
      type: String,
      default: "Supervisor Team",
      trim: true,
      index: true,
    },
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },
    messages: {
      type: [ticketMessageSchema],
      default: [],
    },
    assignedAt: Date,
    resolvedAt: Date,
    closedAt: Date,
    reopenedAt: Date,
  },
  {
    timestamps: true,
    id: false,
    toJSON: { virtuals: false },
    toObject: { virtuals: false },
  }
);

// Keep ticket IDs unique
ticketSchema.index({ ticketId: 1 }, { unique: true, sparse: true });

// Export ticket model
module.exports = mongoose.model("Ticket", ticketSchema);
