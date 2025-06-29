/**
 * Configuration management using environment variables and JSON files
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

class Config {
  constructor() {
    this.validateRequiredEnvVars();
  }

  validateRequiredEnvVars() {
    const required = ['GEMINI_API_KEY', 'OBSIDIAN_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  getGeminiApiKey() {
    return process.env.GEMINI_API_KEY;
  }

  getObsidianApiKey() {
    return process.env.OBSIDIAN_API_KEY;
  }

  getObsidianApiUrl() {
    return process.env.OBSIDIAN_API_URL || 'http://127.0.0.1:27123';
  }

  getRssFeeds() {
    // First try environment variable (for backward compatibility)
    const feedsString = process.env.RSS_FEEDS;
    if (feedsString) {
      try {
        return JSON.parse(feedsString);
      } catch (error) {
        console.error('Error parsing RSS_FEEDS environment variable:', error);
      }
    }
    
    // Read from feeds.json file
    try {
      const feedsPath = path.join(process.cwd(), 'config', 'feeds.json');
      
      if (!fs.existsSync(feedsPath)) {
        console.warn('feeds.json file not found at:', feedsPath);
        return [];
      }
      
      const feedsData = JSON.parse(fs.readFileSync(feedsPath, 'utf8'));
      
      // Extract enabled feeds
      if (feedsData.feeds && Array.isArray(feedsData.feeds)) {
        return feedsData.feeds
          .filter(feed => feed.enabled === true)
          .map(feed => feed.url);
      }
      
      // Fallback: if feeds.json has different structure
      if (Array.isArray(feedsData)) {
        return feedsData;
      }
      
      console.warn('Invalid feeds.json structure');
      return [];
      
    } catch (error) {
      console.error('Error reading feeds.json:', error.message);
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

  getGeminiModel() {
    return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  isDebugMode() {
    return process.env.DEBUG === 'true';
  }
}

module.exports = new Config();