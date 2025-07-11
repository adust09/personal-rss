/**
 * Obsidian Local REST API Client
 * Creates markdown files in Obsidian Vault via Local REST API
 */

const axios = require("axios");
const https = require("https");
const path = require("path");
const Utils = require("./utils");
const config = require("./config");
const { TIMEOUT, PATHS, TEXT, LIMITS } = require("./constants");

class ObsidianAPI {
  constructor() {
    this.apiUrl = config.getObsidianApiUrl();
    this.apiKey = config.getObsidianApiKey();
    this.baseVaultPath = PATHS.OBSIDIAN_BASE_VAULT_PATH; // Base path in Obsidian vault

    // Configure HTTPS agent to handle self-signed certificates
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: !config.getIgnoreSSLErrors(),
    });

    // Validate configuration
    if (!this.apiKey) {
      throw new Error(
        "OBSIDIAN_API_KEY environment variable is required for Obsidian integration"
      );
    }
  }

  /**
   * Get vault path for the given date
   * @param {Date} date
   * @returns {string} Vault directory path
   */
  getDateVaultPath(date = new Date()) {
    const dateString = Utils.formatDate(date);
    return `${this.baseVaultPath}/${dateString}`;
  }

  /**
   * Test connection to Obsidian Local REST API
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.apiUrl}/vault/`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        httpsAgent: this.httpsAgent,
        timeout: TIMEOUT.OBSIDIAN_CONNECTION_TEST,
      });

      Utils.log("info", "Successfully connected to Obsidian Local REST API");
      return response.status === 200;
    } catch (error) {
      Utils.log("error", `Failed to connect to Obsidian API: ${error.message}`);
      if (error.code === "ECONNREFUSED") {
        Utils.log(
          "error",
          "Make sure Obsidian is running with Local REST API plugin enabled"
        );
      }
      return false;
    }
  }

  /**
   * Create markdown file for a tag category via Obsidian API
   * @param {string} tag
   * @param {Object} tagData
   * @param {Date} date
   * @param {boolean} includeHour Whether to include hour in filename
   */
  async createTagFile(tag, tagData, date = new Date(), includeHour = false) {
    const { articles, summary, count } = tagData;

    if (!articles || articles.length === 0) {
      Utils.log("warn", `Skipping empty tag: ${tag}`);
      return;
    }

    const basePath = this.getDateVaultPath(date);

    // Handle hierarchical tags (e.g., tech/ai -> tech directory)
    const tagParts = tag.split("/");
    const baseFileName = tagParts[tagParts.length - 1];

    // Create filename with hour if requested
    const fileName = includeHour
      ? `${baseFileName}-${Utils.formatDateWithHour(date)}.md`
      : `${baseFileName}.md`;

    let vaultPath;
    if (tagParts.length > 1) {
      // Create path for hierarchical tags
      vaultPath = `${basePath}/${tagParts[0]}/${fileName}`;
    } else {
      vaultPath = `${basePath}/${fileName}`;
    }

    // Generate YAML frontmatter
    const frontmatterData = {
      date: Utils.formatDate(date),
      tag: tag,
      count: count,
      tags: [tag],
      generated: new Date().toISOString(),
    };

    if (includeHour) {
      frontmatterData.hour = Utils.getCurrentHour(date);
      frontmatterData.execution_time = Utils.formatDateWithHour(date);
    }

    const frontmatter = Utils.generateYamlFrontmatter(frontmatterData);

    // Generate markdown content
    const content = await this.generateMarkdownContent(tag, tagData, date);
    const fullContent = frontmatter + content;

    // Create file via Obsidian API
    await this.createObsidianFile(vaultPath, fullContent);

    Utils.log(
      "info",
      `Created Obsidian file: ${vaultPath} (${count} articles)`
    );
  }

  /**
   * Create file in Obsidian vault via REST API
   * @param {string} vaultPath Path within vault
   * @param {string} content File content
   */
  async createObsidianFile(vaultPath, content) {
    try {
      const response = await Utils.retry(
        async () => {
          return await axios.put(`${this.apiUrl}/vault/${vaultPath}`, content, {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "text/markdown",
            },
            httpsAgent: this.httpsAgent,
            timeout: TIMEOUT.OBSIDIAN_API_REQUEST,
          });
        },
        config.getMaxRetries(),
        config.getRetryDelay(),
        `Creating Obsidian file: ${vaultPath}`
      );

      if (response.status === 200 || response.status === 201) {
        Utils.log(
          "info",
          `Successfully created file in Obsidian: ${vaultPath}`
        );
      }
    } catch (error) {
      Utils.log(
        "error",
        `Failed to create Obsidian file ${vaultPath}:`,
        error.message
      );
      if (error.response) {
        Utils.log("error", `API Response:`, error.response.data);
      }
      throw error;
    }
  }

  /**
   * Generate single article using template
   * @param {Object} article Single article object
   * @param {number} index Article index (1-based)
   * @returns {Promise<string>} Formatted article
   */
  async generateSingleArticle(article, index) {
    // Format tags
    let formattedTags = "";
    if (article.tags && article.tags.length > 0) {
      const tags = article.tags.map((tag) => {
        if (tag.includes("/")) {
          // Split hierarchical tags: tech/ai -> #tech #ai
          return tag
            .split("/")
            .map((part) => `#${part}`)
            .join(" ");
        } else {
          // Single tag: business -> #business
          return `#${tag}`;
        }
      });
      formattedTags = tags.join(" ");
    }

    // Load template and replace variables
    const template = await Utils.loadTemplate("article-item.md");
    const variables = {
      index: index,
      title: article.title,
      link: article.link,
      feedTitle: article.feedTitle || null,
      creator: article.creator || null,
      pubDate: this.formatDateForDisplay(article.pubDate),
      description:
        article.description && article.description.trim()
          ? article.description
          : null,
      tags: formattedTags || null,
    };

    return Utils.replaceTemplateVariables(template, variables);
  }

  /**
   * Generate articles list for markdown content
   * @param {Array<Object>} articles
   * @returns {Promise<string>} Formatted articles list
   */
  async generateArticlesList(articles) {
    const articlePromises = articles.map((article, index) =>
      this.generateSingleArticle(article, index + 1)
    );

    const formattedArticles = await Promise.all(articlePromises);
    return formattedArticles.join("\n");
  }

  /**
   * Generate markdown content for a tag using template
   * @param {string} tag
   * @param {Object} tagData
   * @param {Date} date
   * @returns {Promise<string>} Markdown content
   */
  async generateMarkdownContent(tag, tagData, date) {
    const { articles, summary, count } = tagData;
    const dateString = Utils.formatDateJapanese(date);

    // Use existing method to generate articles list
    const articlesList = await this.generateArticlesList(articles);

    // Load template and replace variables
    const template = await Utils.loadTemplate("article.md");
    const variables = {
      tag: tag.toUpperCase(),
      dateString: dateString,
      summary: summary,
      count: count,
      articlesList: articlesList,
      generatedTime: new Date().toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      }),
    };

    return Utils.replaceTemplateVariables(template, variables);
  }

  /**
   * Format date for display in articles
   * @param {Date} date
   * @returns {string}
   */
  formatDateForDisplay(date) {
    if (!date) return TEXT.UNKNOWN_DATE_JP;

    try {
      return new Date(date).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return date.toString();
    }
  }

  /**
   * Create all markdown files for processed data
   * @param {Object} processedData
   * @param {Date} date
   * @param {boolean} includeHour Whether to include hour in filename
   */
  async createAllFiles(processedData, date = new Date(), includeHour = false) {
    if (!processedData || Object.keys(processedData).length === 0) {
      Utils.log("warn", "No processed data to create files");
      return;
    }

    Utils.log(
      "info",
      `Creating markdown files for ${
        Object.keys(processedData).length
      } categories`
    );

    const promises = Object.entries(processedData).map(([tag, tagData]) =>
      this.createTagFile(tag, tagData, date, includeHour)
    );

    await Promise.allSettled(promises);

    Utils.log("info", "All markdown files created successfully");
  }

  /**
   * Create index file with overview of all categories
   * @param {Object} processedData
   * @param {Date} date
   */
  async createIndexFile(processedData, date = new Date()) {
    const basePath = this.getDateVaultPath(date);
    const indexPath = `${basePath}/${PATHS.INDEX_FILE_NAME}`;

    const dateString = Utils.formatDateJapanese(date);
    const totalArticles = Object.values(processedData).reduce(
      (sum, data) => sum + data.count,
      0
    );

    const frontmatter = Utils.generateYamlFrontmatter({
      date: Utils.formatDate(date),
      type: "index",
      total_articles: totalArticles,
      categories: Object.keys(processedData).length,
      generated: new Date().toISOString(),
    });

    // Generate categories list
    let categoriesList = "";

    // Sort categories by article count
    const sortedCategories = Object.entries(processedData).sort(
      ([, a], [, b]) => b.count - a.count
    );

    sortedCategories.forEach(([tag, data]) => {
      const fileName = tag.split("/").pop();
      const filePath = tag.includes("/")
        ? `${tag.split("/")[0]}/${fileName}.md`
        : `${fileName}.md`;

      categoriesList += `### [${tag.toUpperCase()}](${filePath}) (${
        data.count
      }件)\n\n`;

      if (data.summary) {
        categoriesList += `${Utils.truncate(
          data.summary,
          LIMITS.SUMMARY_PREVIEW_LENGTH
        )}\n\n`;
      }
    });

    // Load template and replace variables
    const template = await Utils.loadTemplate("index.md");
    const variables = {
      dateString: dateString,
      totalArticles: totalArticles,
      categoriesCount: Object.keys(processedData).length,
      categoriesList: categoriesList,
      generatedTime: new Date().toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      }),
    };

    const content = Utils.replaceTemplateVariables(template, variables);
    const fullContent = frontmatter + content;

    await this.createObsidianFile(indexPath, fullContent);

    Utils.log("info", `Created index file: ${indexPath}`);
  }

  /**
   * Generate all output files in Obsidian vault
   * @param {Object} processedData
   * @param {Date} date
   * @param {boolean} includeHour Whether to include hour in filename
   */
  async generateOutput(processedData, date = new Date(), includeHour = false) {
    if (!processedData || Object.keys(processedData).length === 0) {
      Utils.log("warn", "No data to generate output");
      return;
    }

    // Test connection first
    const connected = await this.testConnection();
    if (!connected) {
      throw new Error(
        "Cannot connect to Obsidian Local REST API. Please ensure Obsidian is running with the plugin enabled."
      );
    }

    await this.createAllFiles(processedData, date, includeHour);
    await this.createIndexFile(processedData, date);

    const vaultPath = this.getDateVaultPath(date);
    Utils.log(
      "info",
      `Output generation complete. Files created in Obsidian vault: ${vaultPath}`
    );
  }

  /**
   * Create keyword summary file
   * @param {string} keyword
   * @param {Object} keywordData
   * @param {Date} date
   * @returns {Promise<void>}
   */
  async createKeywordSummaryFile(keyword, keywordData, date = new Date()) {
    const { articles, summary, count } = keywordData;

    // Create sanitized filename
    const sanitizedKeyword = Utils.sanitizeFilename(keyword);
    const vaultPath = this.getDateVaultPath(date);
    const filePath = `${vaultPath}/${PATHS.KEYWORD_DIRECTORY_NAME}/${sanitizedKeyword}.md`;

    const dateString = Utils.formatDate(date);
    const timestamp = new Date().toISOString();

    // Create YAML frontmatter
    const frontmatter = `---
date: '${dateString}'
keyword: ${keyword}
count: ${count}
type: keyword_summary
generated: '${timestamp}'
---`;

    // Create article list
    const articlesList = await this.generateArticlesList(articles);

    // Create markdown content
    const content = `${frontmatter}

# ${keyword} - ${dateString}

## 概要

${summary}

**記事数**: ${count}件

## 記事一覧

${articlesList}

---

*このファイルは自動生成されました - ${this.formatDateForDisplay(new Date())}*
`;

    try {
      await this.createObsidianFile(filePath, content);
      Utils.log(
        "info",
        `Created keyword summary file: ${filePath} (${count} articles)`
      );
    } catch (error) {
      Utils.log(
        "error",
        `Failed to create keyword summary file for "${keyword}": ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Generate output for keyword-based articles
   * @param {Object} keywordData
   * @param {Date} date
   * @returns {Promise<void>}
   */
  async generateKeywordOutput(keywordData, date = new Date()) {
    if (!keywordData || Object.keys(keywordData).length === 0) {
      Utils.log("info", "No keyword data to generate output");
      return;
    }

    // Test connection first
    const connected = await this.testConnection();
    if (!connected) {
      throw new Error(
        "Cannot connect to Obsidian Local REST API. Please ensure Obsidian is running with the plugin enabled."
      );
    }

    Utils.log(
      "info",
      `Creating keyword summary files for ${
        Object.keys(keywordData).length
      } keywords`
    );

    // Create keyword summary files
    for (const [keyword, data] of Object.entries(keywordData)) {
      await this.createKeywordSummaryFile(keyword, data, date);
    }

    const vaultPath = this.getDateVaultPath(date);
    Utils.log(
      "info",
      `Keyword output generation complete. Files created in: ${vaultPath}/word/`
    );
  }
}

module.exports = new ObsidianAPI();
