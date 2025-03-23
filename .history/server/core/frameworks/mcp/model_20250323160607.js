// server/core/frameworks/mcp/model.js
const logger = require("../../../utils/logger");

/**
 * Model component of MCP architecture - Manages knowledge and state
 */
class Model {
  constructor() {
    this.state = {
      conversation: [],
      context: {},
      sources: [],
      iterations: 0,
    };
  }

  /**
   * Initialize state with a new query
   * @param {string} query - User query
   * @param {Object} context - Additional context
   */
  initializeState(query, context = {}) {
    this.state = {
      query,
      conversation: [{ role: "user", content: query }],
      context,
      sources: [],
      iterations: 0,
      finalAnswer: null,
    };

    logger.debug(`Model: Initialized state with query: ${query}`);
    return this.state;
  }

  /**
   * Update state with new information
   * @param {Object} updates - State updates
   */
  updateState(updates) {
    this.state = {
      ...this.state,
      ...updates,
    };

    // If new sources are provided, merge them
    if (updates.sources && Array.isArray(updates.sources)) {
      this.state.sources = [...this.state.sources, ...updates.sources];

      // Remove duplicates by URL
      this.state.sources = this.state.sources.filter(
        (source, index, self) =>
          index === self.findIndex((s) => s.url === source.url)
      );
    }

    logger.debug(`Model: Updated state, iteration ${this.state.iterations}`);
    return this.state;
  }

  /**
   * Add an observation to the state
   * @param {string} observation - Observation text
   * @param {string} actionName - Action that produced the observation
   */
  addObservation(observation, actionName) {
    this.state.conversation.push({
      role: "system",
      content: `Observation from ${actionName}: ${observation}`,
    });

    logger.debug(`Model: Added observation from ${actionName}`);
    return this.state;
  }

  /**
   * Add reasoning to the state
   * @param {string} thought - Reasoning/thought
   */
  addReasoning(thought) {
    this.state.conversation.push({
      role: "system",
      content: `Thinking: ${thought}`,
    });

    logger.debug(`Model: Added reasoning`);
    return this.state;
  }

  /**
   * Set the final answer
   * @param {string} answer - Final answer text
   */
  setFinalAnswer(answer) {
    this.state.finalAnswer = answer;
    this.state.conversation.push({
      role: "assistant",
      content: answer,
    });

    logger.debug(`Model: Set final answer`);
    return this.state;
  }

  /**
   * Get the current state
   * @returns {Object} - Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get sources found so far
   * @returns {Array} - Sources
   */
  getSources() {
    return this.state.sources;
  }

  /**
   * Get conversation history
   * @returns {Array} - Conversation history
   */
  getConversation() {
    return this.state.conversation;
  }
}

module.exports = Model;

// server/core/frameworks/mcp/controller.js
const logger = require("../../../utils/logger");

/**
 * Controller component of MCP architecture - Executes tools
 */
class Controller {
  constructor(toolbox) {
    this.toolbox = toolbox;
  }

  /**
   * Execute an action using the appropriate tool
   * @param {Object} action - Action to execute
   * @param {Object} state - Current state
   * @returns {Object} - Result of action
   */
  async executeAction(action, state) {
    const { name, params } = action;

    logger.info(`Controller: Executing action ${name}`);

    try {
      // Find the appropriate tool
      const tool = this.toolbox.getTool(name);

      if (!tool) {
        logger.error(`Controller: Tool '${name}' not found`);
        return {
          observation: `Error: Tool '${name}' not found`,
          error: "TOOL_NOT_FOUND",
        };
      }

      // Execute the tool with parameters
      const result = await tool.execute(params, {
        query: state.query,
        context: state.context,
      });

      logger.debug(`Controller: Action ${name} executed successfully`);
      return result;
    } catch (error) {
      logger.error(
        `Controller: Error executing action ${name}: ${error.message}`
      );
      return {
        observation: `Error executing ${name}: ${error.message}`,
        error: error.message,
      };
    }
  }
}

module.exports = Controller;

// server/core/frameworks/mcp/planner.js
const logger = require("../../../utils/logger");

/**
 * Planner component of MCP architecture - Plans actions
 */
class Planner {
  constructor(llmClient) {
    this.llmClient = llmClient;
  }

  /**
   * Decide on the next action to take
   * @param {Object} state - Current state
   * @param {Array} tools - Available tools
   * @returns {Object} - Action plan
   */
  async planNextAction(state, tools) {
    logger.info(
      `Planner: Planning next action for iteration ${state.iterations}`
    );

    // Build prompt for determining next action
    const prompt = this.buildPlanningPrompt(state, tools);

    try {
      // Get LLM decision on next action
      const response = await this.llmClient.complete(prompt, {
        maxTokens: 500,
        temperature: 0.2,
      });

      // Parse the response to extract action and reasoning
      const planResult = this.parseActionResponse(response.text);

      logger.debug(`Planner: Next action planned: ${planResult.action?.name}`);
      return planResult;
    } catch (error) {
      logger.error(`Planner: Error planning next action: ${error.message}`);

      // Default fallback action
      return {
        thought: `Error planning next action: ${error.message}`,
        action: {
          name: "search",
          params: { query: state.query },
        },
        shouldFinish: false,
      };
    }
  }

  /**
   * Build prompt for action planning
   * @param {Object} state - Current state
   * @param {Array} tools - Available tools
   * @returns {string} - Planning prompt
   */
  buildPlanningPrompt(state, tools) {
    const toolDescriptions = tools
      .map(
        (tool) =>
          `${tool.name}: ${
            tool.description
          }\n  Parameters: ${tool.parameters.join(", ")}`
      )
      .join("\n\n");

    const conversationHistory = state.conversation
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n\n");

    const previousObservations =
      state.iterations > 0
        ? `Previous observations:\n${conversationHistory}`
        : "No previous observations.";

    return `
    You are an intelligent assistant using the ReAct (Reasoning + Acting) framework to solve problems step by step.
    
    User query: "${state.query}"
    
    Current iteration: ${state.iterations + 1}
    
    ${previousObservations}
    
    Available tools:
    ${toolDescriptions}
    
    Based on the current state, think step by step about how to respond to the user's query. Then decide on the next action to take.
    
    Your response should follow this format:
    
    Thought: <your reasoning about what needs to be done>
    
    Action: <tool_name>
    Action Parameters: <parameters as JSON object>
    
    If you have enough information to provide a final answer, add:
    
    Final Answer: true
    
    Think carefully about which sources would be most relevant for this query. For Zoom-related questions, prioritize Zoom Community and Zoom Support.
    `;
  }

  /**
   * Parse LLM response to extract action plan
   * @param {string} response - LLM response text
   * @returns {Object} - Parsed action plan
   */
  parseActionResponse(response) {
    // Parse thought
    const thoughtMatch = response.match(
      /Thought:(.*?)(?=Action:|Final Answer:|$)/s
    );
    const thought = thoughtMatch ? thoughtMatch[1].trim() : "";

    // Parse action
    const actionMatch = response.match(/Action:(.*?)(?=Action Parameters:|$)/s);
    const actionName = actionMatch ? actionMatch[1].trim() : "";

    // Parse action parameters
    const paramsMatch = response.match(
      /Action Parameters:(.*?)(?=Final Answer:|$)/s
    );
    let actionParams = {};

    if (paramsMatch) {
      try {
        // Try to parse as JSON
        const paramsText = paramsMatch[1].trim();
        // Handle potential code block formatting
        const jsonContent = paramsText.replace(/```json|```/g, "").trim();
        actionParams = JSON.parse(jsonContent);
      } catch (error) {
        logger.warn(
          `Planner: Failed to parse action parameters as JSON: ${error.message}`
        );
        // Fallback to simple parsing for common parameter patterns
        const paramLines = paramsMatch[1].split("\n");
        for (const line of paramLines) {
          if (line.includes(":")) {
            const [key, value] = line.split(":").map((s) => s.trim());
            if (key && value) {
              actionParams[key] = value;
            }
          }
        }
      }
    }

    // Check if final answer flag is set
    const finalAnswerMatch = response.match(/Final Answer:\s*(true|false)/i);
    const shouldFinish = finalAnswerMatch
      ? finalAnswerMatch[1].toLowerCase() === "true"
      : false;

    // Default to search if no action specified but not finishing
    if (!actionName && !shouldFinish) {
      return {
        thought,
        action: {
          name: "search",
          params: { query: state.query },
        },
        shouldFinish: false,
      };
    }

    return {
      thought,
      action: actionName
        ? {
            name: actionName,
            params: actionParams,
          }
        : null,
      shouldFinish,
    };
  }

  /**
   * Generate final answer based on the collected information
   * @param {Object} state - Current state
   * @returns {string} - Final answer
   */
  async generateFinalAnswer(state) {
    logger.info("Planner: Generating final answer");

    const conversationHistory = state.conversation
      .map(
        (msg) =>
          `${msg.role === "system" ? "Observation" : msg.role}: ${msg.content}`
      )
      .join("\n\n");

    const sources =
      state.sources.length > 0
        ? `Sources found:\n${state.sources
            .map((s, i) => `[${i + 1}] ${s.title} (${s.source}): ${s.url}`)
            .join("\n")}`
        : "No sources were found.";

    const prompt = `
    You are a helpful AI assistant that provides detailed, accurate information about Zoom. Based on the user's query and the information collected, provide a comprehensive answer.
    
    User query: "${state.query}"
    
    Information collected:
    ${conversationHistory}
    
    ${sources}
    
    Your answer should:
    1. Be comprehensive and directly answer the user's question
    2. Include specific details and troubleshooting steps when appropriate
    3. Be well-structured with clear organization
    4. Cite sources by referring to them by number, e.g. [1], [2], when providing information from them
    5. Be factual and avoid speculation
    
    Answer:
    `;

    try {
      const response = await this.llmClient.complete(prompt, {
        maxTokens: 1000,
        temperature: 0.3,
      });

      logger.debug("Planner: Final answer generated successfully");
      return response.text;
    } catch (error) {
      logger.error(`Planner: Error generating final answer: ${error.message}`);
      return `I apologize, but I encountered an error while generating a response to your query. Please try asking again or rephrasing your question.`;
    }
  }
}

module.exports = Planner;
