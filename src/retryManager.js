/**
 * Unified Retry Management System
 * Consolidates retry logic from Utils and ErrorHandler
 */

const { RETRY, TIMEOUT } = require('./constants');
const ErrorHandler = require('./errorHandler');

class RetryManager {
  /**
   * Execute function with unified retry logic
   * @param {string} operation - Operation name for logging
   * @param {Function} fn - Function to execute
   * @param {Object} options - Retry options
   * @returns {Promise} Function result
   */
  static async executeWithRetry(operation, fn, options = {}) {
    const {
      maxRetries = RETRY.DEFAULT_MAX_RETRIES,
      baseDelay = RETRY.DEFAULT_RETRY_DELAY,
      context = {},
      useExponentialBackoff = true,
      timeout = null,
      logSuccess = false
    } = options;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        // Apply timeout if specified
        const result = timeout ? await this.withTimeout(fn, timeout, operation) : await fn();

        if (logSuccess && attempt > 1) {
          ErrorHandler.logSuccess(operation, context, `succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        if (attempt <= maxRetries) {
          const delay = useExponentialBackoff ? baseDelay * Math.pow(2, attempt - 1) : baseDelay;

          ErrorHandler.logError(operation, error, context, attempt, 'warn');
          await this.sleep(delay);
        } else {
          ErrorHandler.logError(operation, error, context, attempt, 'error');
          throw ErrorHandler.createError(operation, `Failed after ${maxRetries + 1} attempts`, context, error);
        }
      }
    }
  }

  /**
   * Execute with timeout wrapper
   * @param {Function} fn - Function to execute
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} operation - Operation name for error
   * @returns {Promise} Function result
   */
  static async withTimeout(fn, timeoutMs, operation) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Get retry configuration for specific operation type
   * @param {string} operationType - Type of operation (feed, gemini, obsidian, etc.)
   * @returns {Object} Retry configuration
   */
  static getRetryConfig(operationType) {
    const configs = {
      feed: {
        maxRetries: RETRY.DEFAULT_MAX_RETRIES,
        baseDelay: RETRY.DEFAULT_RETRY_DELAY,
        timeout: TIMEOUT.HTTP_REQUEST,
        useExponentialBackoff: true
      },
      gemini: {
        maxRetries: RETRY.DEFAULT_MAX_RETRIES,
        baseDelay: RETRY.DEFAULT_GEMINI_REQUEST_DELAY,
        timeout: TIMEOUT.GEMINI_API,
        useExponentialBackoff: true
      },
      obsidian: {
        maxRetries: RETRY.DEFAULT_MAX_RETRIES,
        baseDelay: RETRY.DEFAULT_RETRY_DELAY,
        timeout: TIMEOUT.OBSIDIAN_API_REQUEST,
        useExponentialBackoff: true
      },
      obsidian_test: {
        maxRetries: 1,
        baseDelay: RETRY.DEFAULT_RETRY_DELAY,
        timeout: TIMEOUT.OBSIDIAN_CONNECTION_TEST,
        useExponentialBackoff: false
      },
      keyword_summary: {
        maxRetries: RETRY.KEYWORD_SUMMARY_RETRIES,
        baseDelay: RETRY.KEYWORD_SUMMARY_RETRY_DELAY,
        timeout: TIMEOUT.GEMINI_API,
        useExponentialBackoff: true
      }
    };

    return configs[operationType] || configs.feed;
  }

  /**
   * Execute with predefined operation configuration
   * @param {string} operationType - Type of operation
   * @param {string} operation - Specific operation name
   * @param {Function} fn - Function to execute
   * @param {Object} context - Context for logging
   * @param {Object} overrides - Configuration overrides
   * @returns {Promise} Function result
   */
  static async executeWithConfig(operationType, operation, fn, context = {}, overrides = {}) {
    const config = { ...this.getRetryConfig(operationType), ...overrides };
    return this.executeWithRetry(operation, fn, { ...config, context });
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} Promise that resolves after delay
   */
  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Batch execute multiple operations with retry
   * @param {Array} operations - Array of operation objects
   * @param {Object} options - Global options
   * @returns {Promise<Array>} Array of results
   */
  static async executeBatch(operations, options = {}) {
    const { concurrent = false, failFast = false, logProgress = true } = options;

    if (concurrent) {
      if (failFast) {
        return Promise.all(operations.map(op => this.executeWithRetry(op.operation, op.fn, op.options || {})));
      } else {
        const results = await Promise.allSettled(
          operations.map(op => this.executeWithRetry(op.operation, op.fn, op.options || {}))
        );
        return results
          .map(result => (result.status === 'fulfilled' ? result.value : null))
          .filter(result => result !== null);
      }
    } else {
      const results = [];
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        try {
          if (logProgress) {
            console.log(`Executing ${op.operation} (${i + 1}/${operations.length})`);
          }
          const result = await this.executeWithRetry(op.operation, op.fn, op.options || {});
          results.push(result);
        } catch (error) {
          if (failFast) {
            throw error;
          }
          ErrorHandler.logError('batch_operation', error, { operation: op.operation, index: i });
        }
      }
      return results;
    }
  }
}

module.exports = RetryManager;
