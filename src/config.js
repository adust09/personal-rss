/**
 * Configuration management using environment variables and JSON files
 */

const fs = require("fs");
const path = require("path");
const { DEFAULTS, PATHS, RETRY, CRON, LIMITS } = require('./constants');

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
    return process.env.OBSIDIAN_API_URL || DEFAULTS.OBSIDIAN_API_URL;
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
      const feedsPath = path.join(process.cwd(), PATHS.CONFIG_DIRECTORY, PATHS.FEEDS_CONFIG_FILE);

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
    return process.env.OUTPUT_DIRECTORY || PATHS.DEFAULT_OUTPUT_DIRECTORY;
  }

  getTimezone() {
    return process.env.TIMEZONE || DEFAULTS.TIMEZONE;
  }

  getMaxRetries() {
    return parseInt(process.env.MAX_RETRIES || RETRY.DEFAULT_MAX_RETRIES.toString(), 10);
  }

  getRetryDelay() {
    return parseInt(process.env.RETRY_DELAY || RETRY.DEFAULT_RETRY_DELAY.toString(), 10);
  }

  getGeminiRequestDelay() {
    return parseInt(process.env.GEMINI_REQUEST_DELAY || RETRY.DEFAULT_GEMINI_REQUEST_DELAY.toString(), 10);
  }

  getGeminiModel() {
    return process.env.GEMINI_MODEL || DEFAULTS.GEMINI_MODEL;
  }

  isDebugMode() {
    return process.env.DEBUG === "true";
  }

  getIgnoreSSLErrors() {
    return process.env.IGNORE_SSL_ERRORS === "true";
  }

  getTemplatesDirectory() {
    return process.env.TEMPLATES_DIRECTORY || PATHS.DEFAULT_TEMPLATES_DIRECTORY;
  }

  getPromptsDirectory() {
    return process.env.PROMPTS_DIRECTORY || PATHS.DEFAULT_PROMPTS_DIRECTORY;
  }

  getRssFeedsWithTags() {
    // Try environment variable first
    const envFeeds = this.getFeedsFromEnvironment();
    if (envFeeds) {
      return envFeeds;
    }
    
    // Fall back to file-based configuration
    return this.getFeedsFromFile();
  }

  getFeedsFromEnvironment() {
    const feedsString = process.env.RSS_FEEDS;
    if (!feedsString) {
      return null;
    }
    
    try {
      const urls = JSON.parse(feedsString);
      return urls.map(url => ({ url, parentTag: DEFAULTS.PARENT_TAG }));
    } catch (error) {
      console.error("Error parsing RSS_FEEDS environment variable:", error);
      return null;
    }
  }

  getFeedsFromFile() {
    const feedsPath = path.join(process.cwd(), PATHS.CONFIG_DIRECTORY, PATHS.FEEDS_CONFIG_FILE);
    
    if (!fs.existsSync(feedsPath)) {
      console.warn("feeds.json file not found at:", feedsPath);
      return [];
    }
    
    try {
      const feedsData = this.readFeedsFile(feedsPath);
      return this.processFeedsData(feedsData);
    } catch (error) {
      console.error("Error reading feeds.json:", error.message);
      return [];
    }
  }

  readFeedsFile(feedsPath) {
    const rawData = fs.readFileSync(feedsPath, "utf8");
    return JSON.parse(rawData);
  }

  processFeedsData(feedsData) {
    // Handle structured feeds format
    if (feedsData.feeds && Array.isArray(feedsData.feeds)) {
      return feedsData.feeds
        .filter((feed) => feed.enabled === true)
        .map((feed) => ({
          url: feed.url,
          parentTag: feed.category || DEFAULTS.PARENT_TAG,
          name: feed.name
        }));
    }
    
    // Handle simple array format
    if (Array.isArray(feedsData)) {
      return feedsData.map(url => ({ url, parentTag: DEFAULTS.PARENT_TAG }));
    }
    
    console.warn("Invalid feeds.json structure");
    return [];
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
      const feedsPath = path.join(process.cwd(), PATHS.CONFIG_DIRECTORY, PATHS.FEEDS_CONFIG_FILE);

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
    return process.env.SCHEDULE_ENABLED !== "false";
  }

  /**
   * Get cron schedule pattern
   * @returns {string} Cron expression for scheduling
   */
  getScheduleCron() {
    return process.env.SCHEDULE_CRON || CRON.DEFAULT_SCHEDULE; // Default: every day at 8 AM and 8 PM
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

  /**
   * Get tag configuration from tags.json
   * @returns {Object} Tag configuration object
   */
  getTags() {
    try {
      const tagsPath = path.join(process.cwd(), PATHS.CONFIG_DIRECTORY, PATHS.TAGS_CONFIG_FILE);

      if (!fs.existsSync(tagsPath)) {
        console.warn("tags.json file not found at:", tagsPath);
        return this.getDefaultTags();
      }

      const tagsData = JSON.parse(fs.readFileSync(tagsPath, "utf8"));

      // Validate tags structure
      if (!tagsData.tags || typeof tagsData.tags !== 'object') {
        console.warn("Invalid tags.json structure");
        return this.getDefaultTags();
      }

      return tagsData;
    } catch (error) {
      console.error("Error reading tags.json:", error.message);
      return this.getDefaultTags();
    }
  }

  /**
   * Get default tags configuration (fallback)
   * @returns {Object} Default tag configuration
   */
  getDefaultTags() {
    return {
      "tags": {
        "ai": {
          "display": "AI",
          "description": "Artificial Intelligence and Machine Learning",
          "subtags": ["llm", "rag", "ml", "cv", "nlp"]
        },
        "tech": {
          "display": "Technology",
          "description": "Technology and Software Development",
          "subtags": ["web", "mobile", "devops", "security", "programming", "data"]
        },
        "business": {
          "display": "Business",
          "description": "Business and Management",
          "subtags": ["startup", "marketing", "management"]
        }
      },
      "config": {
        "maxTagsPerArticle": LIMITS.DEFAULT_MAX_TAGS_PER_ARTICLE,
        "defaultTag": DEFAULTS.TAG_NAME,
        "allowMultipleParentTags": DEFAULTS.ALLOW_MULTIPLE_PARENT_TAGS
      }
    };
  }

  /**
   * Get list of available parent tags
   * @returns {Array<string>} Array of parent tag names
   */
  getAvailableParentTags() {
    const tagsConfig = this.getTags();
    return Object.keys(tagsConfig.tags || {});
  }

  /**
   * Get subtags for a specific parent tag
   * @param {string} parentTag
   * @returns {Array<string>} Array of subtag names
   */
  getSubtags(parentTag) {
    const tagsConfig = this.getTags();
    const tagData = tagsConfig.tags?.[parentTag];
    return tagData?.subtags || [];
  }

  /**
   * Get formatted tag list for prompts
   * @returns {string} Formatted tag list string
   */
  getFormattedTagList() {
    const tagsConfig = this.getTags();
    const tags = tagsConfig.tags || {};
    
    return Object.entries(tags)
      .map(([parentTag, tagData]) => {
        const subtags = tagData.subtags || [];
        if (subtags.length > 0) {
          return `- ${parentTag} (${tagData.description}): ${subtags.join(", ")}`;
        }
        return `- ${parentTag} (${tagData.description})`;
      })
      .join("\n");
  }

  /**
   * Get tag configuration settings
   * @returns {Object} Tag configuration settings
   */
  getTagConfig() {
    const tagsConfig = this.getTags();
    return tagsConfig.config || {
      maxTagsPerArticle: LIMITS.DEFAULT_MAX_TAGS_PER_ARTICLE,
      defaultTag: DEFAULTS.TAG_NAME,
      allowMultipleParentTags: DEFAULTS.ALLOW_MULTIPLE_PARENT_TAGS
    };
  }
}

module.exports = new Config();
