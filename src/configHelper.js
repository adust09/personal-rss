/**
 * Configuration Helper
 * Consolidates repeated configuration access patterns
 */

const { RETRY: _RETRY, TIMEOUT, DEFAULTS, PATHS } = require('./constants');

class ConfigHelper {
  /**
   * Get consolidated retry configuration
   * @returns {Object} Retry configuration object
   */
  static getRetryConfig() {
    const config = require('./config');
    return {
      maxRetries: config.getMaxRetries(),
      retryDelay: config.getRetryDelay(),
      geminiDelay: config.getGeminiRequestDelay()
    };
  }

  /**
   * Get consolidated timeout configuration
   * @returns {Object} Timeout configuration object
   */
  static getTimeoutConfig() {
    return {
      rssParser: TIMEOUT.RSS_PARSER,
      httpRequest: TIMEOUT.HTTP_REQUEST,
      obsidianConnection: TIMEOUT.OBSIDIAN_CONNECTION_TEST,
      obsidianApi: TIMEOUT.OBSIDIAN_API_REQUEST,
      geminiApi: TIMEOUT.GEMINI_API
    };
  }

  /**
   * Get environment variable with type casting and validation
   * @param {string} varName - Environment variable name
   * @param {string} type - Expected type (string, number, boolean, json)
   * @param {*} defaultValue - Default value if not set
   * @param {boolean} required - Whether variable is required
   * @returns {*} Parsed value
   */
  static getEnvVar(varName, type = 'string', defaultValue = null, required = false) {
    const value = process.env[varName];

    if (!value && required) {
      throw new Error(`Required environment variable ${varName} is not set`);
    }

    if (!value) {
      return defaultValue;
    }

    switch (type) {
      case 'number': {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue)) {
          throw new Error(`Environment variable ${varName} must be a number, got: ${value}`);
        }
        return numValue;
      }

      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';

      case 'json':
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new Error(`Environment variable ${varName} must be valid JSON: ${error.message}`);
        }

      case 'array':
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            throw new Error(`Environment variable ${varName} must be a JSON array`);
          }
          return parsed;
        } catch (error) {
          throw new Error(`Environment variable ${varName} must be a valid JSON array: ${error.message}`);
        }

      default:
        return value;
    }
  }

  /**
   * Validate required environment variables
   * @param {Array<string>} requiredVars - List of required variable names
   * @throws {Error} If any required variables are missing
   */
  static validateRequiredEnvVars(requiredVars) {
    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Get file path configuration
   * @returns {Object} File path configuration object
   */
  static getPathConfig() {
    const config = require('./config');
    return {
      configDir: PATHS.CONFIG_DIRECTORY,
      feedsFile: PATHS.FEEDS_CONFIG_FILE,
      tagsFile: PATHS.TAGS_CONFIG_FILE,
      outputDir: config.getOutputDirectory(),
      templatesDir: config.getTemplatesDirectory(),
      promptsDir: config.getPromptsDirectory(),
      obsidianBasePath: PATHS.OBSIDIAN_BASE_VAULT_PATH
    };
  }

  /**
   * Get default values configuration
   * @returns {Object} Default values configuration object
   */
  static getDefaultsConfig() {
    return {
      timezone: DEFAULTS.TIMEZONE,
      geminiModel: DEFAULTS.GEMINI_MODEL,
      obsidianApiUrl: DEFAULTS.OBSIDIAN_API_URL,
      parentTag: DEFAULTS.PARENT_TAG,
      tagName: DEFAULTS.TAG_NAME,
      articleTitle: DEFAULTS.ARTICLE_TITLE,
      allowMultipleParentTags: DEFAULTS.ALLOW_MULTIPLE_PARENT_TAGS
    };
  }

  /**
   * Get configuration for specific operation type
   * @param {string} operationType - Type of operation (feed, gemini, obsidian)
   * @returns {Object} Operation-specific configuration
   */
  static getOperationConfig(operationType) {
    const retryConfig = this.getRetryConfig();
    const timeoutConfig = this.getTimeoutConfig();

    const configs = {
      feed: {
        timeout: timeoutConfig.httpRequest,
        maxRetries: retryConfig.maxRetries,
        retryDelay: retryConfig.retryDelay,
        userAgent: require('./constants').HTTP.USER_AGENT,
        maxRedirects: require('./constants').HTTP.MAX_REDIRECTS
      },
      gemini: {
        timeout: timeoutConfig.geminiApi,
        maxRetries: retryConfig.maxRetries,
        retryDelay: retryConfig.geminiDelay,
        model: DEFAULTS.GEMINI_MODEL,
        maxArticles: require('./constants').LIMITS.SUMMARY_ARTICLES
      },
      obsidian: {
        timeout: timeoutConfig.obsidianApi,
        connectionTimeout: timeoutConfig.obsidianConnection,
        maxRetries: retryConfig.maxRetries,
        retryDelay: retryConfig.retryDelay,
        apiUrl: DEFAULTS.OBSIDIAN_API_URL,
        basePath: PATHS.OBSIDIAN_BASE_VAULT_PATH
      }
    };

    return configs[operationType] || {};
  }

  /**
   * Create configuration object for testing
   * @param {Object} overrides - Configuration overrides for testing
   * @returns {Object} Test configuration
   */
  static createTestConfig(overrides = {}) {
    return {
      maxRetries: 1,
      retryDelay: 100,
      timeout: 5000,
      testMode: true,
      articleLimit: require('./constants').LIMITS.TEST_MODE_ARTICLES,
      ...overrides
    };
  }

  /**
   * Get debug configuration
   * @returns {Object} Debug configuration
   */
  static getDebugConfig() {
    const config = require('./config');
    return {
      enabled: config.isDebugMode(),
      verbose: this.getEnvVar('VERBOSE', 'boolean', false),
      logLevel: this.getEnvVar('LOG_LEVEL', 'string', 'info'),
      dryRun: this.getEnvVar('DRY_RUN', 'boolean', false)
    };
  }
}

module.exports = ConfigHelper;
