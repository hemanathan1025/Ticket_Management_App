// Import server tools
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const dns = require("dns");
const User = require("./models/User");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Create Express server
const app = express();
const PORT = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI;
let serverStarted = false;

// Configure allowed origins
const allowedCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.length === 0 || allowedCorsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

if (process.env.MONGODB_DNS_SERVERS) {
  dns.setServers(
    process.env.MONGODB_DNS_SERVERS.split(",")
      .map((server) => server.trim())
      .filter(Boolean)
  );
}

// Configure server middleware
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Hide database credentials
const maskMongoUri = (uri) => uri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");

const isProduction = () => process.env.NODE_ENV === "production";

// Default user accounts
const defaultUsers = [
  {
    name: "Heman Admin",
    email: "admin@company.com",
    role: "admin",
  },
  {
    name: "David Supervisor",
    email: "david@company.com",
    role: "supervisor",
  },
  {
    name: "John Incharge",
    email: "john@company.com",
    role: "incharge",
  },
  {
    name: "Asha Incharge",
    email: "asha@company.com",
    role: "incharge",
  },
  {
    name: "Priya Staff",
    email: "priya.staff@company.com",
    role: "staff",
  },
  {
    name: "Rahul Staff", 
    email: "rahul.staff@company.com",
    role: "staff",
  },
];

mongoose.set("bufferCommands", false);

// Create missing users
const ensureDefaultUsers = async () => {
  const operations = defaultUsers.map((user) => ({
    updateOne: {
      filter: { email: user.email },
      update: { $setOnInsert: user },
      upsert: true,
    },
  }));

  const result = await User.bulkWrite(operations);

  if (result.upsertedCount > 0) {
    console.log(`Created ${result.upsertedCount} default login account(s)`);
  }
};

// Explain database errors
const getMongoConnectionHint = (error) => {
  const message = `${error?.message || ""} ${error?.cause?.message || ""}`.toLowerCase();

  if (message.includes("bad auth") || message.includes("authentication failed")) {
    return "Check Atlas Database Access: username/password in MONGODB_URI must match a database user.";
  }

  if (
    message.includes("whitelist") ||
    message.includes("ip access") ||
    message.includes("tlsv1 alert internal error") ||
    message.includes("ssl alert")
  ) {
    return "Check Atlas Network Access: add your current public IP address to the IP access list, or temporarily add 0.0.0.0/0 for development.";
  }

  if (
    message.includes("querysrv") ||
    message.includes("enotfound") ||
    message.includes("eai_again")
  ) {
    return "Check DNS/internet: the mongodb+srv hostname could not be resolved.";
  }

  return "Check Atlas Network Access, database user credentials, and internet/DNS connectivity.";
};

// Sync ticket indexes
const syncTicketIndexes = async () => {
  try {
    const ticketsCollection = mongoose.connection.collection("tickets");
    const indexes = await ticketsCollection.indexes();
    const hasLegacyIdIndex = indexes.some((index) => index.name === "id_1");

    if (hasLegacyIdIndex) {
      await ticketsCollection.dropIndex("id_1");
      console.log("Dropped legacy tickets.id_1 unique index");
    }

    await ticketsCollection.createIndex(
      { ticketId: 1 },
      { unique: true, sparse: true, name: "ticketId_1" }
    );
  } catch (error) {
    if (error.code === 27 || error.codeName === "IndexNotFound") {
      return;
    }

    console.warn(
      "Could not sync ticket indexes:",
      error.message || error
    );
  }
};

// Start HTTP server
const listen = () => {
  if (serverStarted) {
    return;
  }

  serverStarted = true;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API available on port ${PORT}`);
  });
};

if (!mongoUri) {
  console.error("MONGODB_URI is not defined in backend/.env");
  process.exit(1);
}

console.log("Attempting to connect to MongoDB...");
console.log("Connection URI:", maskMongoUri(mongoUri));

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected");
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err.message);
  console.error("MongoDB hint:", getMongoConnectionHint(err));
});

// Health check route
app.get("/", (req, res) => {
  res.send("Backend Running");
});

// API health route
app.get("/api/health", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const dbState = states[mongoose.connection.readyState] || "unknown";

  res.json({
    status: "ok",
    database: dbState,
    databaseConnected: mongoose.connection.readyState === 1,
  });
});

// Register API routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/otp", require("./routes/otpRoutes"));
app.use("/api/tickets", require("./routes/ticketRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed due to app termination");
  process.exit(0);
});

// Connect to MongoDB
const startServer = async () => {
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 30000,
    });

    console.log("MongoDB connected successfully");

    await ensureDefaultUsers();
    await syncTicketIndexes();

    listen();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.log("MongoDB hint:", getMongoConnectionHint(error));

    if (isProduction()) {
      process.exit(1);
    }

    console.warn(
      "Starting backend without MongoDB. OTP will use in-memory development storage."
    );
    listen();
  }
};

startServer();
