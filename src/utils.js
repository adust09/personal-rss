/**
 * Utility functions
 */

const fs = require('fs').promises;
const path = require('path');
const { format, parseISO: _parseISO } = require('date-fns');
const config = require('./config');
const { LIMITS, INDICES, TEXT } = require('./constants');

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
   * Format date with hour for file naming
   * @param {Date} date
   * @returns {string} YYYY-MM-DD-HH format
   */
  static formatDateWithHour(date = new Date()) {
    return format(date, 'yyyy-MM-dd-HH');
  }

  /**
   * Get current hour
   * @param {Date} date
   * @returns {string} HH format
   */
  static getCurrentHour(date = new Date()) {
    return format(date, 'HH');
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
  static async retry(
    fn,
    maxRetries = config.getMaxRetries(),
    baseDelay = config.getRetryDelay(),
    operationName = 'operation'
  ) {
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
    return filename.replace(TEXT.INVALID_FILENAME_CHARS_REGEX, '').replace(TEXT.WHITESPACE_REGEX, '-').toLowerCase();
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
  static truncate(text, maxLength = LIMITS.DEFAULT_TEXT_TRUNCATE_LENGTH) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - INDICES.TRUNCATE_ELLIPSIS_LENGTH) + '...';
  }

  /**
   * Clean HTML tags from text
   * @param {string} html
   * @returns {string}
   */
  static stripHtml(html) {
    return html.replace(TEXT.HTML_TAGS_REGEX, '').trim();
  }

  /**
   * Load template file
   * @param {string} templateName
   * @returns {Promise<string>}
   */
  static async loadTemplate(templateName) {
    const config = require('./config');
    const templatePath = path.join(config.getTemplatesDirectory(), templateName);

    try {
      const template = await fs.readFile(templatePath, 'utf8');
      return template;
    } catch (error) {
      throw new Error(`Failed to load template ${templateName}: ${error.message}`);
    }
  }

  /**
   * Replace template variables with values
   * @param {string} template
   * @param {Object} variables
   * @returns {string}
   */
  static replaceTemplateVariables(template, variables) {
    let result = template;

    // Handle conditional blocks ({{#variable}} ... {{/variable}})
    Object.keys(variables).forEach(key => {
      const value = variables[key];
      const conditionalRegex = new RegExp(`{{#${key}}}([\\s\\S]*?){{/${key}}}`, 'g');

      if (value && value.toString().trim()) {
        // Replace conditional block with content, then replace variable
        result = result.replace(conditionalRegex, '$1');
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
      } else {
        // Remove conditional block if variable is empty
        result = result.replace(conditionalRegex, '');
      }
    });

    // Replace simple variables ({{variable}})
    Object.keys(variables).forEach(key => {
      const value = variables[key] || '';
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return result;
  }

  /**
   * Load prompt file and extract content
   * @param {string} promptName
   * @returns {Promise<string>}
   */
  static async loadPrompt(promptName) {
    const config = require('./config');
    const promptPath = path.join(config.getPromptsDirectory(), promptName);

    try {
      const content = await fs.readFile(promptPath, 'utf8');

      // Extract content after YAML frontmatter
      const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
      const match = content.match(frontmatterRegex);

      if (match) {
        return match[2].trim(); // Return content after frontmatter
      } else {
        return content.trim(); // Return full content if no frontmatter
      }
    } catch (error) {
      throw new Error(`Failed to load prompt ${promptName}: ${error.message}`);
    }
  }

  /**
   * Replace prompt variables with values
   * @param {string} prompt
   * @param {Object} variables
   * @returns {string}
   */
  static replacePromptVariables(prompt, variables) {
    let result = prompt;

    // Replace simple variables ({{variable}})
    Object.keys(variables).forEach(key => {
      const value = variables[key] || '';
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return result;
  }
}

module.exports = Utils;
