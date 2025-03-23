// server/api/controllers/agent.controller.js
const logger = require("../../utils/logger");
const GeneralAgent = require("../../core/agents/general");

// Initialize agent instances
const generalAgent = new GeneralAgent();

exports.processQuery = async (req, res) => {
  try {
    const { query, selectedAgents, selectedSources, files } = req.body;

    if (!query || query.trim() === "") {
      return res.status(400).json({ error: "Query is required" });
    }

    logger.info(
      `API: Processing query "${query}" with agents: ${
        selectedAgents || "general"
      }`
    );

    // For now, we only have the general agent implemented
    const response = await generalAgent.process(query, {
      sources: selectedSources,
      files,
      context: { userId: req.user?.id || "anonymous" },
    });

    return res.status(200).json(response);
  } catch (error) {
    logger.error(`API Error: ${error.message}`);
    return res.status(500).json({
      error: "Failed to process query",
      details: error.message,
    });
  }
};

// server/api/routes/agent.routes.js
const express = require("express");
const router = express.Router();
const agentController = require("../controllers/agent.controller");
const multer = require("multer");

// Set up file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Process query
router.post("/query", upload.array("files", 5), agentController.processQuery);

module.exports = router;

// server/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const logger = require("./utils/logger");
const config = require("./config/config");

// Import routes
const agentRoutes = require("./api/routes/agent.routes");

// Initialize express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Simple middleware for user identification (replace with actual auth in production)
app.use((req, res, next) => {
  req.user = { id: "anonymous" };
  next();
});

// Routes
app.use("/api/agent", agentRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", environment: config.environment });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res
    .status(500)
    .json({ error: "Internal server error", details: err.message });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${config.environment} mode`);
});

module.exports = app;
