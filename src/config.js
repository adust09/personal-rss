/**
 * Configuration management using environment variables
 */

class Config {
  constructor() {
    this.validateRequiredEnvVars();
  }

  validateRequiredEnvVars() {
    const required = ['GEMINI_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  getGeminiApiKey() {
    return process.env.GEMINI_API_KEY;
  }

  getObsidianApiKey() {
    return process.env.OBSIDIAN_API_KEY || null;
  }

  getObsidianApiUrl() {
    return process.env.OBSIDIAN_API_URL || 'https://127.0.0.1:27123';
  }

  getRssFeeds() {
    const feedsString = process.env.RSS_FEEDS;
    if (!feedsString) {
      return [];
    }
    
    try {
      return JSON.parse(feedsString);
    } catch (error) {
      console.error('Error parsing RSS_FEEDS environment variable:', error);
      return [];
    }
  }

  getOutputDirectory() {
    return process.env.OUTPUT_DIRECTORY || './output';
  }

  getTimezone() {
    return process.env.TIMEZONE || 'Asia/Tokyo';
  }

  getMaxRetries() {
    return parseInt(process.env.MAX_RETRIES || '3', 10);
  }

  getRetryDelay() {
    return parseInt(process.env.RETRY_DELAY || '1000', 10);
  }

  getGeminiRequestDelay() {
    return parseInt(process.env.GEMINI_REQUEST_DELAY || '1000', 10);
  }

  isDebugMode() {
    return process.env.DEBUG === 'true';
  }
}

module.exports = new Config();