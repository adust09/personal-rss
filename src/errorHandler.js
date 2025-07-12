/**
 * Centralized Error Handler for RSS Feeder
 * Provides consistent error handling, logging, and context
 */

const config = require('./config');

class ErrorHandler {
  /**
   * Log error with standardized format and context
   * @param {string} operation - Operation name (e.g., 'feed_fetch', 'gemini_request')
   * @param {Error} error - The error object
   * @param {Object} context - Additional context (feedUrl, articleTitle, etc.)
   * @param {number} attempt - Current retry attempt number
   * @param {string} severity - 'fatal', 'error', 'warn', 'info'
   */
  static logError(operation, error, context = {}, attempt = 0, severity = 'error') {
    const timestamp = new Date().toISOString();
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');

    const retryInfo = attempt > 0 ? ` (attempt ${attempt})` : '';
    const message = `[${timestamp}] [${severity.toUpperCase()}] ${operation}${retryInfo}: ${error.message}`;

    if (contextStr) {
      const fullMessage = `${message} | Context: ${contextStr}`;
      this.logByLevel(severity, fullMessage);
    } else {
      this.logByLevel(severity, message);
    }

    // Log stack trace in debug mode
    if (config.isDebugMode() && severity === 'error') {
      console.error('Stack trace:', error.stack);
    }
  }

  /**
   * Create standardized error with context
   * @param {string} operation - Operation name
   * @param {string} message - Error message
   * @param {Object} context - Additional context
   * @param {Error} originalError - Original error if wrapping
   * @returns {Error} Enhanced error object
   */
  static createError(operation, message, context = {}, originalError = null) {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');

    const fullMessage = contextStr ? `${operation}: ${message} | Context: ${contextStr}` : `${operation}: ${message}`;

    const error = new Error(fullMessage);
    error.operation = operation;
    error.context = context;
    error.originalError = originalError;

    return error;
  }

  /**
   * Enhanced retry with consistent error logging
   * @param {string} operation - Operation name
   * @param {Function} fn - Function to retry
   * @param {Object} context - Context for logging
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise} Function result
   */
  static async retryWithLogging(operation, fn, context = {}, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt <= maxRetries) {
          this.logError(operation, error, context, attempt, 'warn');
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        } else {
          this.logError(operation, error, context, attempt, 'error');
          throw this.createError(operation, `Failed after ${maxRetries + 1} attempts`, context, error);
        }
      }
    }
  }

  /**
   * Log success operations for consistency
   * @param {string} operation - Operation name
   * @param {Object} context - Context information
   * @param {string} message - Success message
   */
  static logSuccess(operation, context = {}, message = 'completed successfully') {
    const timestamp = new Date().toISOString();
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');

    const fullMessage = contextStr
      ? `[${timestamp}] [INFO] ${operation}: ${message} | Context: ${contextStr}`
      : `[${timestamp}] [INFO] ${operation}: ${message}`;

    if (config.isDebugMode()) {
      console.log(fullMessage);
    }
  }

  /**
   * Log by severity level
   * @param {string} level - Log level
   * @param {string} message - Message to log
   */
  static logByLevel(level, message) {
    switch (level) {
      case 'fatal':
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      default:
        console.log(message);
    }
  }

  /**
   * Sleep utility for retries
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wrap function with error handling
   * @param {string} operation - Operation name
   * @param {Function} fn - Function to wrap
   * @param {Object} context - Context for logging
   * @returns {Function} Wrapped function
   */
  static wrap(operation, fn, context = {}) {
    return async (...args) => {
      try {
        const result = await fn(...args);
        this.logSuccess(operation, context);
        return result;
      } catch (error) {
        this.logError(operation, error, context, 0, 'error');
        throw error;
      }
    };
  }
}

// Operation name constants for consistency
ErrorHandler.OPERATIONS = {
  // Feed operations
  FEED_FETCH: 'feed_fetch',
  FEED_PARSE: 'feed_parse',
  FEED_FILTER: 'feed_filter',

  // LLM operations
  GEMINI_REQUEST: 'gemini_request',
  ARTICLE_TAGGING: 'article_tagging',
  SUMMARY_GENERATION: 'summary_generation',
  KEYWORD_SUMMARY: 'keyword_summary',

  // File operations
  FILE_READ: 'file_read',
  FILE_WRITE: 'file_write',
  TEMPLATE_LOAD: 'template_load',

  // Obsidian operations
  OBSIDIAN_CONNECTION: 'obsidian_connection',
  OBSIDIAN_CREATE_FILE: 'obsidian_create_file',
  OBSIDIAN_API_REQUEST: 'obsidian_api_request',

  // Configuration operations
  CONFIG_LOAD: 'config_load',
  CONFIG_PARSE: 'config_parse',
  ENV_VAR_READ: 'env_var_read',

  // Daemon operations
  DAEMON_START: 'daemon_start',
  SCHEDULER_INIT: 'scheduler_init',
  HEALTH_CHECK: 'health_check'
};

module.exports = ErrorHandler;
