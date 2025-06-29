#!/usr/bin/env node

/**
 * Main orchestration script
 * Handles RSS feed processing workflow
 */

const feedFetcher = require("./feedFetcher");
const llmProcessor = require("./llmProcessor");
const fileOutput = require("./obsidianAPI");
const config = require("./config");
const Utils = require("./utils");

class RSSFeeder {
  constructor() {
    this.startTime = new Date();
  }

  /**
   * Main execution function
   */
  async run() {
    try {
      Utils.log("info", "🚀 RSS Feeder starting...");

      // Validate configuration
      this.validateConfiguration();

      // Step 1: Fetch all articles from RSS feeds
      Utils.log("info", "📰 Fetching RSS feeds...");
      const articles = await feedFetcher.getAllArticles(true); // Only today's articles

      if (!articles || articles.length === 0) {
        Utils.log("warn", "No articles found for today. Exiting.");
        return;
      }

      Utils.log("info", `Found ${articles.length} articles to process`);

      // Step 2: Process articles with LLM (tagging and summarization)
      Utils.log("info", "🤖 Processing articles with Gemini API...");
      const processedData = await llmProcessor.processArticles(articles);

      if (!processedData || Object.keys(processedData).length === 0) {
        Utils.log("warn", "No processed data generated. Exiting.");
        return;
      }

      // Step 3: Generate output files
      Utils.log("info", "📁 Generating output files...");
      await fileOutput.generateOutput(processedData);

      // Summary
      const totalCategories = Object.keys(processedData).length;
      const totalProcessedArticles = Object.values(processedData).reduce(
        (sum, data) => sum + data.count,
        0
      );
      const executionTime = Math.round((new Date() - this.startTime) / 1000);

      Utils.log("info", `✅ RSS Feeder completed successfully!`);
      Utils.log(
        "info",
        `📊 Summary: ${totalProcessedArticles} articles processed into ${totalCategories} categories`
      );
      Utils.log("info", `⏱️  Execution time: ${executionTime} seconds`);
    } catch (error) {
      Utils.log("error", "❌ RSS Feeder failed:", error.message);

      if (config.isDebugMode()) {
        console.error("Full error details:", error);
      }

      process.exit(1);
    }
  }

  /**
   * Validate configuration before starting
   */
  validateConfiguration() {
    Utils.log("info", "🔧 Validating configuration...");

    // Check required API keys
    if (!config.getGeminiApiKey()) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    if (!config.getObsidianApiKey()) {
      throw new Error("OBSIDIAN_API_KEY environment variable is required");
    }

    // Check RSS feeds
    const feeds = config.getRssFeeds();
    if (!feeds || feeds.length === 0) {
      Utils.log(
        "warn",
        "No RSS feeds configured. Please configure feeds in config/feeds.json or set RSS_FEEDS environment variable."
      );
      Utils.log(
        "info",
        "Environment variable example: RSS_FEEDS='[\"https://example.com/feed.xml\"]'"
      );
      Utils.log(
        "info",
        "Or edit config/feeds.json and set enabled: true for desired feeds"
      );
      throw new Error("No RSS feeds configured");
    }

    Utils.log("info", `Configured with ${feeds.length} RSS feeds`);

    // Log configuration (without sensitive data)
    if (config.isDebugMode()) {
      Utils.log("info", "Configuration:");
      Utils.log("info", `- Obsidian API URL: ${config.getObsidianApiUrl()}`);
      Utils.log("info", `- Timezone: ${config.getTimezone()}`);
      Utils.log("info", `- Max retries: ${config.getMaxRetries()}`);
      Utils.log(
        "info",
        `- Gemini request delay: ${config.getGeminiRequestDelay()}ms`
      );
      Utils.log("info", `- RSS feeds: ${feeds.length} configured`);
    }
  }

  /**
   * Health check function for monitoring
   */
  async healthCheck() {
    try {
      Utils.log("info", "🏥 Running health check...");

      // Check Obsidian API connection
      const obsidianConnected = await fileOutput.testConnection();
      if (!obsidianConnected) {
        throw new Error("Obsidian API connection failed");
      }

      // Check if we can access Gemini API
      const testPrompt = 'Hello, please respond with "OK"';
      await llmProcessor.makeGeminiRequest(testPrompt);

      Utils.log("info", "✅ Health check passed");
      return true;
    } catch (error) {
      Utils.log("error", "❌ Health check failed:", error.message);
      return false;
    }
  }

  /**
   * Test run with limited data
   */
  async testRun() {
    try {
      Utils.log("info", "🧪 Running test mode...");

      // Fetch only one feed for testing
      const feeds = config.getRssFeeds();
      if (feeds.length === 0) {
        throw new Error("No RSS feeds configured for testing");
      }

      const testFeed = feeds[0];
      Utils.log("info", `Testing with feed: ${testFeed}`);

      const feed = await feedFetcher.fetchFeed(testFeed);
      const limitedArticles = feed.items.slice(0, 2); // Test with only 2 articles

      Utils.log("info", `Processing ${limitedArticles.length} test articles`);

      const processedData = await llmProcessor.processArticles(limitedArticles);

      if (processedData && Object.keys(processedData).length > 0) {
        await fileOutput.generateOutput(processedData);
        Utils.log("info", "✅ Test run completed successfully");
      } else {
        Utils.log("warn", "Test run generated no processed data");
      }
    } catch (error) {
      Utils.log("error", "❌ Test run failed:", error.message);
      throw error;
    }
  }
}

// CLI handling
async function main() {
  const feeder = new RSSFeeder();

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "health":
      await feeder.healthCheck();
      break;

    case "test":
      await feeder.testRun();
      break;

    case "help":
      console.log(`
RSS Feeder - Personal RSS Processing Tool

Usage:
  node src/main.js [command]

Commands:
  (no command)  Run the full RSS processing pipeline
  health        Run health check
  test          Run with limited data for testing
  help          Show this help

Configuration:
  config/feeds.json      Required: RSS feeds configuration file
  GEMINI_API_KEY         Required: Your Gemini API key (environment variable)
  OBSIDIAN_API_KEY       Required: Obsidian Local REST API key (environment variable)

Environment Variables:
  RSS_FEEDS              Optional: JSON array of RSS feed URLs (overrides feeds.json)
  OBSIDIAN_API_URL       Optional: Obsidian API URL (default: https://127.0.0.1:27124/)
  DEBUG                  Optional: Enable debug mode (true/false)
  TIMEZONE               Optional: Timezone (default: Asia/Tokyo)
  MAX_RETRIES            Optional: Max retry attempts (default: 3)
  GEMINI_REQUEST_DELAY   Optional: Delay between API calls in ms (default: 1000)

Example:
  # Setup Obsidian Local REST API plugin and get API key, then:
  export GEMINI_API_KEY="your-gemini-api-key"
  export OBSIDIAN_API_KEY="your-obsidian-api-key"
  node src/main.js
  
  # Or use RSS_FEEDS environment variable:
  export RSS_FEEDS='["https://example.com/feed.xml"]'
  node src/main.js
      `);
      break;

    default:
      await feeder.run();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = RSSFeeder;
