// server/config/config.js
require("dotenv").config();

module.exports = {
  port: process.env.PORT || 5000,
  environment: process.env.NODE_ENV || "development",

  // Claude API configuration
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
    model: process.env.CLAUDE_MODEL || "claude-3-opus-20240229",
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || "4000", 10),
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || "0.3"),
  },

  // Search sources configuration
  sources: {
    zoomCommunity: {
      baseUrl: "https://community.zoom.com/",
      searchEndpoint: "/search",
    },
    zoomSupport: {
      baseUrl: "https://support.zoom.com/hc",
      searchEndpoint: "/search",
    },
    google: {
      baseUrl: "https://www.googleapis.com/customsearch/v1",
      apiKey: process.env.GOOGLE_API_KEY,
      cx: process.env.GOOGLE_SEARCH_CX, // Custom Search Engine ID
    },
  },

  // Agent configuration
  agents: {
    general: {
      maxIterations: 5,
      defaultSources: ["zoomCommunity", "zoomSupport", "google"],
      debug: process.env.DEBUG_AGENT === "true",
    },
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

// .env.example file content
/*
PORT=5000
NODE_ENV=development

# Claude API
CLAUDE_API_KEY=your_claude_api_key
CLAUDE_MODEL=claude-3-opus-20240229
CLAUDE_MAX_TOKENS=4000
CLAUDE_TEMPERATURE=0.3

# Google API
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_CX=your_custom_search_engine_id

# Debug options
DEBUG_AGENT=false
LOG_LEVEL=info
*/
