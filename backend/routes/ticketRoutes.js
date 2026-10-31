// Import route tools
const express = require("express");

const {
  addTicketComment,
  assignTicket,
  createTicket,
  deleteTicket,
  getTicketById,
  getTickets,
  updateTicketStatus,
} = require("../controllers/ticketController");
const { authenticate } = require("../middleware/authMiddleware");
const { uploadImages } = require("../middleware/upload");

// Create ticket routes
const router = express.Router();

router.use(authenticate);

// Create ticket
router.post("/", uploadImages("images", 5), createTicket);
// Get all tickets
router.get("/", getTickets);
// Get one ticket
router.get("/:id", getTicketById);
// Update ticket status
router.put("/:id/status", updateTicketStatus);
// Assign ticket owner
router.put("/:id/assign", assignTicket);
// Add chat message
router.post("/:id/comments", addTicketComment);
// Delete ticket
router.delete("/:id", deleteTicket);

// Export ticket routes
module.exports = router;
