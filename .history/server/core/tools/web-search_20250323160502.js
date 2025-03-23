// server/core/tools/web-search.js
const axios = require('axios');
const config = require('../../config/config');
const logger = require('../../utils/logger');
const claudeClient = require('../../services/llm/claude-client');

class WebSearchTool {
  constructor() {
    this.name = 'search';
    this.description = 'Search for information from Zoom Community, Zoom Support, and Google';
    this.parameters = ['query', 'sources'];
    this.config = config.sources;
  }

  /**
   * Execute web search across specified sources
   * @param {Object} params - Search parameters
   * @param {Object} context - Agent context
   * @returns {Object} - Search results
   */
  async execute(params, context) {
    const query = params.query || context.query;
    const sources = params.sources || ['zoomCommunity', 'zoomSupport', 'google'];

    logger.info(`Searching for "${query}" in sources: ${sources.join(', ')}`);

    try {
      // For each source, fetch results
      const searchPromises = sources.map(source => this.searchSource(source, query));
      const searchResults = await Promise.allSettled(searchPromises);

      // Process results, handling any failed promises
      const allResults = searchResults
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return result.value;
          } else {
            logger.error(`Error searching ${sources[index]}: ${result.reason}`);
            return [];
          }
        })
        .flat()
        .filter(Boolean);

      // Sort by relevance
      const sortedResults = this.rankResults(allResults, query);

      // Extract most relevant results
      const topResults = sortedResults.slice(0, 5);

      // Summarize results if there are any
      let summary = '';
      if (topResults.length > 0) {
        summary = await this.summarizeResults(topResults, query);
      }

      return {
        observation: `Found ${allResults.length} results across ${sources.length} sources. Top results:\n${
          topResults.map((r, i) => `${i + 1}. ${r.title} (${r.source})`).join('\n')
        }\n\nSummary: ${summary}`,
        sources: topResults.map(result => ({
          title: result.title,
          url: result.url,
          source: result.source,
          snippet: result.snippet
        }))
      };
    } catch (error) {
      logger.error('Error executing search:', error);
      return {
        observation: `Error searching for "${query}": ${error.message}`,
        error: error.message,
        sources: []
      };
    }
  }

  /**
   * Search a specific source
   * @param {string} sourceId - Source ID
   * @param {string} query - Search query
   * @returns {Array} - Search results
   */
  async searchSource(sourceId, query) {
    // In production, implement actual API calls to each source
    // For the initial version, we'll use a mock implementation
    
    logger.debug(`Searching ${sourceId} for "${query}"`);

    // For early development/testing, use mock data
    if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_SEARCH === 'true') {
      return this.getMockResults(sourceId, query);
    }

    // Real implementation for Google Custom Search
    if (sourceId === 'google' && config.sources.google.apiKey) {
      try {
        const response = await axios.get(config.sources.google.baseUrl, {
          params: {
            key: config.sources.google.apiKey,
            cx: config.sources.google.cx,
            q: `${query} site:community.zoom.com OR site:support.zoom.com`,
            num: 5
          }
        });

        return response.data.items.map(item => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet,
          source: item.displayLink.includes('community') ? 'Zoom Community' : 'Zoom Support',
          relevance: 0.9 // Placeholder for real relevance scoring
        }));
      } catch (error) {
        logger.error(`Google search error: ${error.message}`);
        return [];
      }
    }

    // For Zoom Community and Zoom Support, we'd need to implement
    // web scraping or use their API if available.
    // For now, return mock data
    return this.getMockResults(sourceId, query);
  }

  /**
   * Get mock results for development/testing
   * @param {string} sourceId - Source ID
   * @param {string} query - Search query
   * @returns {Array} - Mock search results
   */
  getMockResults(sourceId, query) {
    const lowerQuery = query.toLowerCase();
    
    if (sourceId === 'zoomCommunity') {
      return [
        {
          title: 'Troubleshooting Zoom Connection Issues',
          url: 'https://community.zoom.com/t5/Zoom-Rooms/Connection-Issues-Troubleshooting/td-p/37482',
          snippet: 'Common connection issues include firewall blocking, network instability, and server overload. To resolve these issues, try the following steps...',
          source: 'Zoom Community',
          relevance: lowerQuery.includes('connection') ? 0.95 : 0.7
        },
        {
          title: 'How to resolve audio problems in Zoom meetings',
          url: 'https://community.zoom.com/t5/Meetings/Audio-Issues-Solutions/td-p/28943',
          snippet: 'If you're experiencing audio issues in Zoom meetings, check your speaker/microphone settings, ensure proper device permissions...',
          source: 'Zoom Community',
          relevance: lowerQuery.includes('audio') ? 0.92 : 0.6
        }
      ];
    } else if (sourceId === 'zoomSupport') {
      return [
        {
          title: 'Getting Started with Zoom: A Comprehensive Guide',
          url: 'https://support.zoom.com/hc/en-us/articles/360034967471-Getting-started-guide-for-new-users',
          snippet: 'This guide walks through setting up your Zoom account, scheduling your first meeting, and customizing your settings for optimal performance.',
          source: 'Zoom Support',
          relevance: lowerQuery.includes('start') || lowerQuery.includes('guide') ? 0.9 : 0.65
        },
        {
          title: 'Resolving Common Video and Camera Issues',
          url: 'https://support.zoom.com/hc/en-us/articles/202952568-My-Video-Camera-Isn-t-Working',
          snippet: 'Learn how to troubleshoot video and camera problems in Zoom meetings, including checking device permissions, testing your video, and updating drivers.',
          source: 'Zoom Support',
          relevance: lowerQuery.includes('video') || lowerQuery.includes('camera') ? 0.94 : 0.6
        }
      ];
    } else {
      return [
        {
          title: 'Top 10 Zoom Tips for Remote Work Success',
          url: 'https://example.com/zoom-tips',
          snippet: 'Discover the best practices for using Zoom effectively in remote work environments, including keyboard shortcuts, security settings, and engagement tools.',
          source: 'Google Search',
          relevance: lowerQuery.includes('tips') ? 0.85 : 0.5
        }
      ];
    }
  }

  /**
   * Rank search results by relevance
   * @param {Array} results - Search results
   * @param {string} query - Search query
   * @returns {Array} - Ranked results
   */
  rankResults(results, query) {
    // In a real implementation, use more sophisticated ranking algorithms
    // For now, sort by the mock relevance scores
    return results.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Summarize search results
   * @param {Array} results - Search results
   * @param {string} query - Original query
   * @returns {string} - Summary
   */
  async summarizeResults(results, query) {
    // Use Claude to generate a coherent summary from the search results
    const prompt = `
    Based on the following search results for the query "${query}", provide a concise summary of the key information:

    ${results.map((r, i) => `[${i+1}] ${r.title}
    Source: ${r.source}
    Snippet: ${r.snippet}
    `).join('\n')}

    Summarize the most relevant information from these sources that directly answers the query. Focus on factual information.
    `;

    try {
      const response = await claudeClient.complete(prompt, {
        maxTokens: 300,
        temperature: 0.2
      });

      return response.text;
    } catch (error) {
      logger.error(`Error summarizing results: ${error.message}`);
      return "Unable to generate summary due to an error.";
    }
  }
}

module.exports = WebSearchTool;