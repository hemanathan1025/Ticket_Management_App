// Import ticket models
const Counter = require("../models/Counter");
const Ticket = require("../models/Ticket");
const { uploadTicketImage } = require("../utils/uploadToCloudinary");

// Validate ticket values
const VALID_PRIORITIES = new Set(["Low", "Medium", "High", "Critical"]);
const VALID_STATUSES = new Set(["new", "active", "resolved", "closed"]);

// Read ticket number
const getTicketNumber = (ticketId = "") => {
  const match = String(ticketId).match(/\d+/);

  return match ? Number.parseInt(match[0], 10) : 0;
};

// Normalize ticket status
const normalizeStatus = (status) => {
  const value = typeof status === "string" ? status.trim().toLowerCase() : "";

  if (value === "process") {
    return "active";
  }

  if (value === "open") {
    return "new";
  }

  return value;
};

// Find highest ticket
const getHighestTicketNumber = async () => {
  const tickets = await Ticket.find({}, { ticketId: 1 }).lean();
  return tickets.reduce(
    (currentHighest, ticket) => Math.max(currentHighest, getTicketNumber(ticket.ticketId)),
    100,
  );
};

// Create next ticket ID
const getNextTicketId = async () => {
  const highestTicketNumber = await getHighestTicketNumber();
  const counter = await Counter.findByIdAndUpdate(
    "ticketId",
    [
      {
        $set: {
          seq: {
            $add: [
              {
                $max: [
                  { $ifNull: ["$seq", 100] },
                  highestTicketNumber,
                ],
              },
              1,
            ],
          },
        },
      },
    ],
    { new: true, upsert: true, updatePipeline: true }
  ).lean();

  return String(counter.seq);
};

// Find requested ticket
const findTicketByParam = async (id) => {
  const query = [{ ticketId: id }];

  if (/^[a-f\d]{24}$/i.test(id)) {
    query.push({ _id: id });
  }

  return Ticket.findOne({ $or: query });
};

// Create ticket
const createTicket = async (req, res) => {
  const body = req.body || {};
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const priority = typeof body.priority === "string" ? body.priority.trim() : "";
  const issueType =
    typeof body.issueType === "string" ? body.issueType.trim() : "";
  const staffId = typeof body.staffId === "string" ? body.staffId.trim() : "";
  const staffName =
    typeof body.staffName === "string" ? body.staffName.trim() : "";
  const createdById =
    typeof body.createdById === "string" && body.createdById.trim()
      ? body.createdById.trim()
      : req.user?.userId || "";
  const createdBy =
    typeof body.createdBy === "string" && body.createdBy.trim()
      ? body.createdBy.trim()
      : req.user?.name || "";
  const assignedTo =
    typeof body.assignedTo === "string" && body.assignedTo.trim()
      ? body.assignedTo.trim()
      : "Supervisor Team";
  const status = normalizeStatus(body.status) || "new";

  if (!title || !description || !createdBy || !createdById) {
    return res.status(400).json({
      success: false,
      message: "Title, description, createdBy, and createdById are required",
    });
  }

  if (!staffId || !issueType) {
    return res.status(400).json({
      success: false,
      message: "Staff and issue type are required",
    });
  }

  if (!VALID_PRIORITIES.has(priority)) {
    return res.status(400).json({
      success: false,
      message: "Priority must be Low, Medium, High, or Critical",
    });
  }

  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be new, active, resolved, or closed",
    });
  }

  try {
    const now = new Date();
    const uploadedImages = await Promise.all(
      (req.files || []).slice(0, 5).map((file) => uploadTicketImage(file.buffer))
    );
    const imageUrls = uploadedImages.map((image) => image.secure_url);
    console.log("[tickets] Cloudinary image URLs:", imageUrls);
    const ticket = await Ticket.create({
      ticketId: await getNextTicketId(),
      title,
      description,
      priority,
      issueType,
      staffId,
      staffName,
      status,
      createdBy,
      createdById,
      assignedTo,
      imageUrl: imageUrls[0] || "",
      images: imageUrls,
      assignedAt: assignedTo ? now : undefined,
      messages: [
        {
          id: `MSG-${Date.now()}`,
          author: createdBy,
          text: "Ticket created. Please review and update the status.",
          timestamp: now,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      ticket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create ticket",
    });
  }
};

// Get all tickets
const getTickets = async (req, res) => {
  try {
    const filters = [];

    if (req.query.assignedTo) {
      filters.push({ assignedTo: req.query.assignedTo });
    }

    if (req.query.status) {
      filters.push({ status: normalizeStatus(req.query.status) });
    }

    if (req.user?.role === "incharge") {
      const ownerFilters = [];

      if (req.user.userId) {
        ownerFilters.push({ createdById: req.user.userId });
      }

      if (req.user.name) {
        ownerFilters.push({ createdBy: req.user.name });
      }

      filters.push({ $or: ownerFilters.length ? ownerFilters : [{ _id: null }] });
    }

    const query = filters.length ? { $and: filters } : {};
    const tickets = await Ticket.find(query).sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      tickets,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch tickets",
    });
  }
};

// Get one ticket
const getTicketById = async (req, res) => {
  try {
    const ticket = await findTicketByParam(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (
      req.user?.role === "incharge" &&
      String(ticket.createdById || "") !== String(req.user.userId || "") &&
      String(ticket.createdBy || "") !== String(req.user.name || "")
    ) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    return res.json({
      success: true,
      ticket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch ticket",
    });
  }
};

// Update ticket status
const updateTicketStatus = async (req, res) => {
  const status = normalizeStatus(req.body?.status);

  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be new, active, resolved, or closed",
    });
  }

  try {
    const ticket = await findTicketByParam(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    const now = new Date();
    const wasResolved = ticket.status === "resolved";

    ticket.status = status;

    if (status === "resolved") {
      ticket.resolvedAt = now;
    }

    if (status === "closed") {
      ticket.closedAt = now;
    }

    if (status === "active" && wasResolved) {
      ticket.reopenedAt = now;
    }

    const updatedTicket = await ticket.save();

    return res.json({
      success: true,
      ticket: updatedTicket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update ticket status",
    });
  }
};

// Assign ticket owner
const assignTicket = async (req, res) => {
  const assignedTo =
    typeof req.body?.assignedTo === "string" ? req.body.assignedTo.trim() : "";

  if (!assignedTo) {
    return res.status(400).json({
      success: false,
      message: "assignedTo is required",
    });
  }

  try {
    const ticket = await findTicketByParam(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    ticket.assignedTo = assignedTo;
    ticket.assignedAt = new Date();

    const updatedTicket = await ticket.save();

    return res.json({
      success: true,
      ticket: updatedTicket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to assign ticket",
    });
  }
};

// Add chat message
const addTicketComment = async (req, res) => {
  const author = typeof req.body?.author === "string" ? req.body.author.trim() : "";
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

  if (!author || !text) {
    return res.status(400).json({
      success: false,
      message: "author and text are required",
    });
  }

  try {
    const ticket = await findTicketByParam(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    ticket.messages.push({
      id: `MSG-${Date.now()}`,
      author,
      text,
      timestamp: new Date(),
    });

    const updatedTicket = await ticket.save();

    return res.json({
      success: true,
      ticket: updatedTicket,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add ticket comment",
    });
  }
};

// Delete ticket
const deleteTicket = async (req, res) => {
  try {
    const ticket = await findTicketByParam(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    await ticket.deleteOne();

    return res.json({
      success: true,
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete ticket",
    });
  }
};

// Export ticket handlers
module.exports = {
  addTicketComment,
  assignTicket,
  createTicket,
  deleteTicket,
  getTicketById,
  getTickets,
  updateTicketStatus,
};
