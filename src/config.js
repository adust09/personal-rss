/**
 * Configuration management using environment variables and JSON files
 */

const fs = require("fs");
const path = require("path");

// Load environment variables from .env file
require("dotenv").config();

class Config {
  constructor() {
    this.validateRequiredEnvVars();
  }

  validateRequiredEnvVars() {
    const required = ["GEMINI_API_KEY", "OBSIDIAN_API_KEY"];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
      );
    }
  }

  getGeminiApiKey() {
    return process.env.GEMINI_API_KEY;
  }

  getObsidianApiKey() {
    return process.env.OBSIDIAN_API_KEY;
  }

  getObsidianApiUrl() {
    return process.env.OBSIDIAN_API_URL || "https://127.0.0.1:27124/";
  }

  getRssFeeds() {
    // First try environment variable (for backward compatibility)
    const feedsString = process.env.RSS_FEEDS;
    if (feedsString) {
      try {
        return JSON.parse(feedsString);
      } catch (error) {
        console.error("Error parsing RSS_FEEDS environment variable:", error);
      }
    }

    // Read from feeds.json file
    try {
      const feedsPath = path.join(process.cwd(), "config", "feeds.json");

      if (!fs.existsSync(feedsPath)) {
        console.warn("feeds.json file not found at:", feedsPath);
        return [];
      }

      const feedsData = JSON.parse(fs.readFileSync(feedsPath, "utf8"));

      // Extract enabled feeds
      if (feedsData.feeds && Array.isArray(feedsData.feeds)) {
        return feedsData.feeds
          .filter((feed) => feed.enabled === true)
          .map((feed) => feed.url);
      }

      // Fallback: if feeds.json has different structure
      if (Array.isArray(feedsData)) {
        return feedsData;
      }

      console.warn("Invalid feeds.json structure");
      return [];
    } catch (error) {
      console.error("Error reading feeds.json:", error.message);
      return [];
    }
  }

  getOutputDirectory() {
    return process.env.OUTPUT_DIRECTORY || "./output";
  }

  getTimezone() {
    return process.env.TIMEZONE || "Asia/Tokyo";
  }

  getMaxRetries() {
    return parseInt(process.env.MAX_RETRIES || "3", 10);
  }

  getRetryDelay() {
    return parseInt(process.env.RETRY_DELAY || "1000", 10);
  }

  getGeminiRequestDelay() {
    return parseInt(process.env.GEMINI_REQUEST_DELAY || "1000", 10);
  }

  getGeminiModel() {
    return process.env.GEMINI_MODEL || "gemini-2.5-flash";
  }

  isDebugMode() {
    return process.env.DEBUG === "true";
  }

  getIgnoreSSLErrors() {
    return process.env.IGNORE_SSL_ERRORS === "true";
  }

  getTemplatesDirectory() {
    return process.env.TEMPLATES_DIRECTORY || "./templates";
  }

  getPromptsDirectory() {
    return process.env.PROMPTS_DIRECTORY || "./prompts";
  }

  getRssFeedsWithTags() {
    // First try environment variable (for backward compatibility)
    const feedsString = process.env.RSS_FEEDS;
    if (feedsString) {
      try {
        const urls = JSON.parse(feedsString);
        // Environment variable only provides URLs, default to 'tech' parentTag
        return urls.map(url => ({ url, parentTag: 'tech' }));
      } catch (error) {
        console.error("Error parsing RSS_FEEDS environment variable:", error);
      }
    }

    // Read from feeds.json file
    try {
      const feedsPath = path.join(process.cwd(), "config", "feeds.json");

      if (!fs.existsSync(feedsPath)) {
        console.warn("feeds.json file not found at:", feedsPath);
        return [];
      }

      const feedsData = JSON.parse(fs.readFileSync(feedsPath, "utf8"));

      // Extract enabled feeds with parentTag
      if (feedsData.feeds && Array.isArray(feedsData.feeds)) {
        return feedsData.feeds
          .filter((feed) => feed.enabled === true)
          .map((feed) => ({
            url: feed.url,
            parentTag: feed.category || 'tech',
            name: feed.name
          }));
      }

      // Fallback: if feeds.json has different structure
      if (Array.isArray(feedsData)) {
        return feedsData.map(url => ({ url, parentTag: 'tech' }));
      }

      console.warn("Invalid feeds.json structure");
      return [];
    } catch (error) {
      console.error("Error reading feeds.json:", error.message);
      return [];
    }
  }

  /**
   * Get watch words for keyword-based article filtering
   * @returns {Array<string>} Array of watch words
   */
  getWatchWords() {
    // First try environment variable
    const watchWordsString = process.env.WATCH_WORDS;
    if (watchWordsString) {
      try {
        const words = JSON.parse(watchWordsString);
        if (Array.isArray(words)) {
          return words.filter(word => typeof word === 'string' && word.trim().length > 0);
        }
      } catch (error) {
        console.error("Error parsing WATCH_WORDS environment variable:", error);
      }
    }

    // Read from feeds.json file
    try {
      const feedsPath = path.join(process.cwd(), "config", "feeds.json");

      if (!fs.existsSync(feedsPath)) {
        return [];
      }

      const feedsData = JSON.parse(fs.readFileSync(feedsPath, "utf8"));

      // Extract watch words from feeds.json
      if (feedsData.watchWords && Array.isArray(feedsData.watchWords)) {
        return feedsData.watchWords.filter(word => typeof word === 'string' && word.trim().length > 0);
      }

      return [];
    } catch (error) {
      console.error("Error reading watch words from feeds.json:", error.message);
      return [];
    }
  }

  /**
   * Check if hourly file generation is enabled
   * @returns {boolean} Whether to include hour in filename
   */
  getEnableHourlyFiles() {
    return process.env.ENABLE_HOURLY_FILES === "true";
  }

  /**
   * Check if scheduler is enabled
   * @returns {boolean} Whether scheduler should run
   */
  isScheduleEnabled() {
    return process.env.SCHEDULE_ENABLED === "true";
  }

  /**
   * Get cron schedule pattern
   * @returns {string} Cron expression for scheduling
   */
  getScheduleCron() {
    return process.env.SCHEDULE_CRON || "0 */12 * * *"; // Default: every 12 hours
  }

  /**
   * Get timezone for scheduler
   * @returns {string} Timezone string
   */
  getScheduleTimezone() {
    return process.env.SCHEDULE_TIMEZONE || this.getTimezone();
  }

  /**
   * Check if daemon mode is enabled
   * @returns {boolean} Whether to run in daemon mode
   */
  isDaemonMode() {
    return process.env.DAEMON_MODE === "true";
  }

  /**
   * Check if initial execution should run on daemon start
   * @returns {boolean} Whether to run immediately on start
   */
  getRunOnStart() {
    return process.env.RUN_ON_START === "true";
  }
}

module.exports = new Config();
