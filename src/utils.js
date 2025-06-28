/**
 * Utility functions
 */

const fs = require('fs').promises;
const path = require('path');
const { format, parseISO } = require('date-fns');
const config = require('./config');

class Utils {
  /**
   * Sleep/delay function
   * @param {number} milliseconds 
   */
  static async sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * Format date for file naming
   * @param {Date} date 
   * @returns {string} YYYY-MM-DD format
   */
  static formatDate(date = new Date()) {
    return format(date, 'yyyy-MM-dd');
  }

  /**
   * Format date for Japanese display
   * @param {Date} date 
   * @returns {string} YYYY年MM月DD日 format
   */
  static formatDateJapanese(date = new Date()) {
    return format(date, 'yyyy年MM月dd日');
  }

  /**
   * Create directory if it doesn't exist
   * @param {string} dirPath 
   */
  static async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Write file with proper error handling and directory creation
   * @param {string} filePath 
   * @param {string} content 
   */
  static async writeFile(filePath, content) {
    const dir = path.dirname(filePath);
    await this.ensureDirectory(dir);
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`Written file: ${filePath}`);
  }

  /**
   * Retry function with exponential backoff
   * @param {Function} fn Function to retry
   * @param {number} maxRetries Maximum number of retries
   * @param {number} baseDelay Base delay in milliseconds
   * @param {string} operationName Name for logging
   */
  static async retry(fn, maxRetries = config.getMaxRetries(), baseDelay = config.getRetryDelay(), operationName = 'operation') {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`${operationName} failed after ${maxRetries + 1} attempts:`, error.message);
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Log with timestamp
   * @param {string} level 
   * @param {string} message 
   * @param {any} data 
   */
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (level === 'error') {
      console.error(logMessage, data || '');
    } else if (level === 'warn') {
      console.warn(logMessage, data || '');
    } else {
      console.log(logMessage, data || '');
    }
  }

  /**
   * Sanitize filename by removing invalid characters
   * @param {string} filename 
   * @returns {string}
   */
  static sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  /**
   * Generate YAML frontmatter
   * @param {Object} metadata 
   * @returns {string}
   */
  static generateYamlFrontmatter(metadata) {
    const yaml = require('js-yaml');
    return '---\n' + yaml.dump(metadata) + '---\n\n';
  }

  /**
   * Group array items by a key function
   * @param {Array} array 
   * @param {Function} keyFn 
   * @returns {Object}
   */
  static groupBy(array, keyFn) {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {});
  }

  /**
   * Truncate text to specified length
   * @param {string} text 
   * @param {number} maxLength 
   * @returns {string}
   */
  static truncate(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Clean HTML tags from text
   * @param {string} html 
   * @returns {string}
   */
  static stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').trim();
  }
}

module.exports = Utils;