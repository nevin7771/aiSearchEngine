// server/core/frameworks/react/index.js
const logger = require("../../../utils/logger");

/**
 * ReAct Framework - Implements the Reasoning + Acting cycle
 */
class ReActFramework {
  constructor(model, controller, planner, config = {}) {
    this.model = model;
    this.controller = controller;
    this.planner = planner;
    this.maxIterations = config.maxIterations || 5;
    this.debug = config.debug || false;
  }

  /**
   * Process a query using the ReAct framework
   * @param {string} query - User query
   * @param {Object} context - Additional context
   * @returns {Object} - Final response
   */
  async process(query, context = {}) {
    logger.info(`ReAct: Processing query "${query}"`);

    // Initialize state
    this.model.initializeState(query, context);

    // Execute ReAct loop
    try {
      await this.executeReActLoop();

      // Get final state
      const state = this.model.getState();

      // Format response
      const response = this.formatResponse(state);
      logger.info(`ReAct: Processing complete for query "${query}"`);

      return response;
    } catch (error) {
      logger.error(`ReAct: Error processing query: ${error.message}`);

      return {
        answer: `I encountered an error while processing your query: ${error.message}. Please try again or rephrase your question.`,
        sources: [],
        error: error.message,
      };
    }
  }

  /**
   * Execute the ReAct loop until completion or max iterations
   */
  async executeReActLoop() {
    let state = this.model.getState();
    const tools = this.controller.toolbox.listTools();

    // Continue until max iterations or we have a final answer
    while (state.iterations < this.maxIterations && !state.finalAnswer) {
      // Increment iteration counter
      this.model.updateState({ iterations: state.iterations + 1 });
      state = this.model.getState();

      logger.info(`ReAct: Starting iteration ${state.iterations}`);

      // 1. THINK: Plan the next action
      const planResult = await this.planner.planNextAction(state, tools);

      // Add reasoning to state
      this.model.addReasoning(planResult.thought);

      // If we should finish, generate final answer
      if (planResult.shouldFinish) {
        logger.info("ReAct: Generating final answer");
        const finalAnswer = await this.planner.generateFinalAnswer(state);
        this.model.setFinalAnswer(finalAnswer);
        break;
      }

      // 2. ACT: Execute the planned action
      const actionResult = await this.controller.executeAction(
        planResult.action,
        state
      );

      // 3. OBSERVE: Process the results
      // Add observation to state
      this.model.addObservation(
        actionResult.observation,
        planResult.action.name
      );

      // Update sources if available
      if (actionResult.sources) {
        this.model.updateState({ sources: actionResult.sources });
      }

      // Check if we've reached max iterations and need to force completion
      if (state.iterations >= this.maxIterations && !state.finalAnswer) {
        logger.info("ReAct: Reached max iterations, generating final answer");
        const finalAnswer = await this.planner.generateFinalAnswer(state);
        this.model.setFinalAnswer(finalAnswer);
      }

      // Update state for next iteration
      state = this.model.getState();
    }
  }

  /**
   * Format the final response
   * @param {Object} state - Final state
   * @returns {Object} - Formatted response
   */
  formatResponse(state) {
    // De-duplicate sources by URL
    const uniqueSources = state.sources.filter(
      (source, index, self) =>
        index === self.findIndex((s) => s.url === source.url)
    );

    const response = {
      answer:
        state.finalAnswer ||
        "I was unable to generate a complete answer. Please try rephrasing your question.",
      sources: uniqueSources.slice(0, 5), // Limit to top 5 sources
    };

    // Add debug info if enabled
    if (this.debug) {
      response.debugInfo = {
        iterations: state.iterations,
        conversationHistory: state.conversation,
      };
    }

    return response;
  }
}

module.exports = ReActFramework;
