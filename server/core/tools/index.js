// server/core/tools/index.js
const logger = require("../../utils/logger");

/**
 * ToolBox class - manages available tools
 */
class ToolBox {
  constructor() {
    this.tools = {};
  }

  /**
   * Register a tool
   * @param {Object} tool - Tool instance
   */
  registerTool(tool) {
    this.tools[tool.name] = tool;
    logger.debug(`ToolBox: Registered tool '${tool.name}'`);
  }

  /**
   * Get a tool by name
   * @param {string} name - Tool name
   * @returns {Object} - Tool instance
   */
  getTool(name) {
    return this.tools[name];
  }

  /**
   * List available tools
   * @returns {Array} - Available tools
   */
  listTools() {
    return Object.values(this.tools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}

module.exports = ToolBox;
