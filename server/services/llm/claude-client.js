// server/services/llm/claude-client.js
const { Anthropic } = require("@anthropic-ai/sdk");
const config = require("../../config/config");
const logger = require("../../utils/logger");

class ClaudeClient {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.claude.apiKey,
    });
    this.defaultModel = config.claude.model;
    this.defaultMaxTokens = config.claude.maxTokens;
    this.defaultTemperature = config.claude.temperature;
  }

  /**
   * Send a message to Claude API
   * @param {string} prompt - The prompt to send to Claude
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Claude API response
   */
  async complete(prompt, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const maxTokens = options.maxTokens || this.defaultMaxTokens;
      const temperature = options.temperature || this.defaultTemperature;

      logger.debug(
        `Sending request to Claude API (model: ${model}, maxTokens: ${maxTokens})`
      );

      const response = await this.anthropic.messages.create({
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        system:
          options.systemPrompt ||
          "You are a helpful assistant that provides accurate and detailed information.",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      logger.debug(
        `Received response from Claude API (tokenUsage: ${JSON.stringify(
          response.usage
        )})`
      );

      return {
        text: response.content[0].text,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error) {
      logger.error(`Error calling Claude API: ${error.message}`);
      throw new Error(`Failed to get completion from Claude: ${error.message}`);
    }
  }
}

module.exports = new ClaudeClient();
