/**
 * RSS Feeder class
 * Handles RSS feed processing workflow
 */

const feedFetcher = require('./feedFetcher');
const llmProcessor = require('./llmProcessor');
const fileOutput = require('./obsidianAPI');
const config = require('./config');
const Utils = require('./utils');

class RSSFeeder {
  constructor() {
    this.startTime = new Date();
  }

  /**
   * Main execution function
   */
  async run() {
    try {
      Utils.log('info', '🚀 RSS Feeder starting...');

      // Validate configuration
      this.validateConfiguration();

      // Step 1: Fetch all articles from RSS feeds
      Utils.log('info', '📰 Fetching RSS feeds...');
      const articles = await feedFetcher.getAllArticles(true); // Only today's articles

      if (!articles || articles.length === 0) {
        Utils.log('warn', 'No articles found for today. Exiting.');
        return;
      }

      Utils.log('info', `Found ${articles.length} articles to process`);

      // Step 2: Process articles with LLM (tagging and summarization)
      Utils.log('info', '🤖 Processing articles with Gemini API...');
      const processedData = await llmProcessor.processArticles(articles);

      if (!processedData || Object.keys(processedData).length === 0) {
        Utils.log('warn', 'No processed data generated. Exiting.');
        return;
      }

      // Step 3: Process keyword-based articles (if watch words are configured)
      Utils.log('info', '🔍 Processing keyword-based articles...');
      const keywordData = await llmProcessor.processKeywordArticles(articles);

      // Step 4: Generate output files
      Utils.log('info', '📁 Generating output files...');
      const includeHour = config.getEnableHourlyFiles();
      await fileOutput.generateOutput(processedData, this.startTime, includeHour);

      // Step 5: Generate keyword output files (if any keyword data exists)
      if (keywordData && Object.keys(keywordData).length > 0) {
        Utils.log('info', '📝 Generating keyword summary files...');
        await fileOutput.generateKeywordOutput(keywordData);
      }

      // Summary
      const totalCategories = Object.keys(processedData).length;
      const totalKeywords = keywordData ? Object.keys(keywordData).length : 0;
      const totalProcessedArticles = Object.values(processedData).reduce((sum, data) => sum + data.count, 0);
      const executionTime = Math.round((new Date() - this.startTime) / 1000);

      Utils.log('info', '✅ RSS Feeder completed successfully!');
      Utils.log('info', `📊 Summary: ${totalProcessedArticles} articles processed into ${totalCategories} categories`);
      if (totalKeywords > 0) {
        const totalKeywordArticles = Object.values(keywordData).reduce((sum, data) => sum + data.count, 0);
        Utils.log('info', `🔍 Keywords: ${totalKeywordArticles} articles matched ${totalKeywords} keywords`);
      }
      Utils.log('info', `⏱️  Execution time: ${executionTime} seconds`);
    } catch (error) {
      Utils.log('error', '❌ RSS Feeder failed:', error.message);

      if (config.isDebugMode()) {
        console.error('Full error details:', error);
      }

      process.exit(1);
    }
  }

  /**
   * Validate configuration before starting
   */
  validateConfiguration() {
    Utils.log('info', '🔧 Validating configuration...');

    // Check required API keys
    if (!config.getGeminiApiKey()) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    if (!config.getObsidianApiKey()) {
      throw new Error('OBSIDIAN_API_KEY environment variable is required');
    }

    // Check RSS feeds
    const feeds = config.getRssFeeds();
    if (!feeds || feeds.length === 0) {
      Utils.log(
        'warn',
        'No RSS feeds configured. Please configure feeds in config/feeds.json or set RSS_FEEDS environment variable.'
      );
      Utils.log('info', 'Environment variable example: RSS_FEEDS=\'["https://example.com/feed.xml"]\'');
      Utils.log('info', 'Or edit config/feeds.json and set enabled: true for desired feeds');
      throw new Error('No RSS feeds configured');
    }

    Utils.log('info', `Configured with ${feeds.length} RSS feeds`);

    // Log configuration (without sensitive data)
    if (config.isDebugMode()) {
      Utils.log('info', 'Configuration:');
      Utils.log('info', `- Obsidian API URL: ${config.getObsidianApiUrl()}`);
      Utils.log('info', `- Timezone: ${config.getTimezone()}`);
      Utils.log('info', `- Max retries: ${config.getMaxRetries()}`);
      Utils.log('info', `- Gemini request delay: ${config.getGeminiRequestDelay()}ms`);
      Utils.log('info', `- RSS feeds: ${feeds.length} configured`);
    }
  }

  /**
   * Health check function for monitoring
   */
  async healthCheck() {
    try {
      Utils.log('info', '🏥 Running health check...');

      // Check Obsidian API connection
      const obsidianConnected = await fileOutput.testConnection();
      if (!obsidianConnected) {
        throw new Error('Obsidian API connection failed');
      }

      // Check if we can access Gemini API
      const testPrompt = await Utils.loadPrompt('health-check.md');
      await llmProcessor.makeGeminiRequest(testPrompt);

      Utils.log('info', '✅ Health check passed');
      return true;
    } catch (error) {
      Utils.log('error', '❌ Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Test run with limited data
   */
  async testRun() {
    try {
      Utils.log('info', '🧪 Running test mode...');

      // Fetch only one feed for testing
      const feeds = config.getRssFeeds();
      if (feeds.length === 0) {
        throw new Error('No RSS feeds configured for testing');
      }

      const testFeed = feeds[0];
      Utils.log('info', `Testing with feed: ${testFeed}`);

      const feed = await feedFetcher.fetchFeed(testFeed);
      const limitedArticles = feed.items.slice(0, 2); // Test with only 2 articles

      Utils.log('info', `Processing ${limitedArticles.length} test articles`);

      const processedData = await llmProcessor.processArticles(limitedArticles);

      // Test keyword processing
      Utils.log('info', '🔍 Processing keyword-based articles...');
      const keywordData = await llmProcessor.processKeywordArticles(limitedArticles);

      if (processedData && Object.keys(processedData).length > 0) {
        const includeHour = config.getEnableHourlyFiles();
        await fileOutput.generateOutput(processedData, new Date(), includeHour);

        // Test keyword output
        if (keywordData && Object.keys(keywordData).length > 0) {
          Utils.log('info', '📝 Generating keyword summary files...');
          await fileOutput.generateKeywordOutput(keywordData);
        }

        Utils.log('info', '✅ Test run completed successfully');
      } else {
        Utils.log('warn', 'Test run generated no processed data');
      }
    } catch (error) {
      Utils.log('error', '❌ Test run failed:', error.message);
      throw error;
    }
  }
}

module.exports = RSSFeeder;
