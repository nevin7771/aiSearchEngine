// server/core/agents/general/index.js
const logger = require("../../../utils/logger");
const config = require("../../../config/config");
const claudeClient = require("../../../services/llm/claude-client");

// MCP Architecture Components
const Model = require("../../frameworks/mcp/model");
const Controller = require("../../frameworks/mcp/controller");
const Planner = require("../../frameworks/mcp/planner");

// ReAct Framework
const ReActFramework = require("../../frameworks/react");

// Tools
const ToolBox = require("../../tools");
const WebSearchTool = require("../../tools/web-search");

/**
 * General Agent - Uses MCP architecture and ReAct framework to answer general queries
 */
class GeneralAgent {
  constructor() {
    // Initialize ToolBox and register tools
    this.toolbox = new ToolBox();
    this.toolbox.registerTool(new WebSearchTool());

    // Initialize MCP components
    this.model = new Model();
    this.controller = new Controller(this.toolbox);
    this.planner = new Planner(claudeClient);

    // Initialize ReAct framework
    this.react = new ReActFramework(this.model, this.controller, this.planner, {
      maxIterations: config.agents.general.maxIterations,
      debug: config.agents.general.debug,
    });

    logger.info("GeneralAgent: Initialized");
  }

  /**
   * Process a query
   * @param {string} query - User query
   * @param {Object} options - Processing options
   * @returns {Object} - Agent response
   */
  async process(query, options = {}) {
    logger.info(`GeneralAgent: Processing query "${query}"`);

    const context = {
      sources: options.sources || config.agents.general.defaultSources,
      files: options.files || [],
      ...options.context,
    };

    try {
      // Use ReAct framework to process the query
      const response = await this.react.process(query, context);
      return response;
    } catch (error) {
      logger.error(`GeneralAgent: Error processing query: ${error.message}`);
      return {
        answer: `I encountered an error while processing your query. Please try again or rephrase your question.`,
        error: error.message,
        sources: [],
      };
    }
  }
}

module.exports = GeneralAgent;
