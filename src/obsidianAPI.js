/**
 * Obsidian Local REST API Client
 * Creates markdown files in Obsidian Vault via Local REST API
 */

const axios = require('axios');
const https = require('https');
const path = require('path');
const Utils = require('./utils');
const config = require('./config');

class ObsidianAPI {
  constructor() {
    this.apiUrl = config.getObsidianApiUrl();
    this.apiKey = config.getObsidianApiKey();
    this.baseVaultPath = 'RSS'; // Base path in Obsidian vault
    
    // Configure HTTPS agent to handle self-signed certificates
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: !config.getIgnoreSSLErrors()
    });
    
    // Validate configuration
    if (!this.apiKey) {
      throw new Error('OBSIDIAN_API_KEY environment variable is required for Obsidian integration');
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
          'Authorization': `Bearer ${this.apiKey}`
        },
        httpsAgent: this.httpsAgent,
        timeout: 5000
      });
      
      Utils.log('info', 'Successfully connected to Obsidian Local REST API');
      return response.status === 200;
      
    } catch (error) {
      Utils.log('error', `Failed to connect to Obsidian API: ${error.message}`);
      if (error.code === 'ECONNREFUSED') {
        Utils.log('error', 'Make sure Obsidian is running with Local REST API plugin enabled');
      }
      return false;
    }
  }

  /**
   * Create markdown file for a tag category via Obsidian API
   * @param {string} tag 
   * @param {Object} tagData 
   * @param {Date} date 
   */
  async createTagFile(tag, tagData, date = new Date()) {
    const { articles, summary, count } = tagData;
    
    if (!articles || articles.length === 0) {
      Utils.log('warn', `Skipping empty tag: ${tag}`);
      return;
    }

    const basePath = this.getDateVaultPath(date);
    
    // Handle hierarchical tags (e.g., tech/ai -> tech directory)
    const tagParts = tag.split('/');
    const fileName = `${tagParts[tagParts.length - 1]}.md`;
    
    let vaultPath;
    if (tagParts.length > 1) {
      // Create path for hierarchical tags
      vaultPath = `${basePath}/${tagParts[0]}/${fileName}`;
    } else {
      vaultPath = `${basePath}/${fileName}`;
    }

    // Generate YAML frontmatter
    const frontmatter = Utils.generateYamlFrontmatter({
      date: Utils.formatDate(date),
      tag: tag,
      count: count,
      tags: [tag],
      generated: new Date().toISOString()
    });

    // Generate markdown content
    const content = this.generateMarkdownContent(tag, tagData, date);
    const fullContent = frontmatter + content;
    
    // Create file via Obsidian API
    await this.createObsidianFile(vaultPath, fullContent);
    
    Utils.log('info', `Created Obsidian file: ${vaultPath} (${count} articles)`);
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
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'text/markdown'
            },
            httpsAgent: this.httpsAgent,
            timeout: 10000
          });
        },
        config.getMaxRetries(),
        config.getRetryDelay(),
        `Creating Obsidian file: ${vaultPath}`
      );

      if (response.status === 200 || response.status === 201) {
        Utils.log('info', `Successfully created file in Obsidian: ${vaultPath}`);
      }
      
    } catch (error) {
      Utils.log('error', `Failed to create Obsidian file ${vaultPath}:`, error.message);
      if (error.response) {
        Utils.log('error', `API Response:`, error.response.data);
      }
      throw error;
    }
  }

  /**
   * Generate markdown content for a tag
   * @param {string} tag 
   * @param {Object} tagData 
   * @param {Date} date 
   * @returns {string} Markdown content
   */
  generateMarkdownContent(tag, tagData, date) {
    const { articles, summary, count } = tagData;
    const dateString = Utils.formatDateJapanese(date);
    
    let content = `# ${tag.toUpperCase()} - ${dateString}\n\n`;
    
    // Add summary if available
    if (summary && summary.trim()) {
      content += `## 概要\n\n${summary}\n\n`;
    }
    
    // Add article count
    content += `**記事数**: ${count}件\n\n`;
    
    // Add articles list
    content += `## 記事一覧\n\n`;
    
    articles.forEach((article, index) => {
      content += `### ${index + 1}. ${article.title}\n\n`;
      
      // Article metadata
      content += `**リンク**: [${article.link}](${article.link})\n\n`;
      
      if (article.feedTitle) {
        content += `**ソース**: ${article.feedTitle}\n\n`;
      }
      
      if (article.creator) {
        content += `**著者**: ${article.creator}\n\n`;
      }
      
      content += `**公開日**: ${this.formatDateForDisplay(article.pubDate)}\n\n`;
      
      // Article description/content
      if (article.description && article.description.trim()) {
        content += `**概要**:\n${article.description}\n\n`;
      }
      
      // Tags
      if (article.tags && article.tags.length > 0) {
        content += `**タグ**: ${article.tags.join(', ')}\n\n`;
      }
      
      content += `---\n\n`;
    });
    
    // Add generation info
    content += `\n---\n\n`;
    content += `*このファイルは自動生成されました - ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}*\n`;
    
    return content;
  }

  /**
   * Format date for display in articles
   * @param {Date} date 
   * @returns {string}
   */
  formatDateForDisplay(date) {
    if (!date) return '不明';
    
    try {
      return new Date(date).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return date.toString();
    }
  }

  /**
   * Create all markdown files for processed data
   * @param {Object} processedData 
   * @param {Date} date 
   */
  async createAllFiles(processedData, date = new Date()) {
    if (!processedData || Object.keys(processedData).length === 0) {
      Utils.log('warn', 'No processed data to create files');
      return;
    }

    Utils.log('info', `Creating markdown files for ${Object.keys(processedData).length} categories`);

    const promises = Object.entries(processedData).map(([tag, tagData]) => 
      this.createTagFile(tag, tagData, date)
    );

    await Promise.allSettled(promises);

    Utils.log('info', 'All markdown files created successfully');
  }

  /**
   * Create index file with overview of all categories
   * @param {Object} processedData 
   * @param {Date} date 
   */
  async createIndexFile(processedData, date = new Date()) {
    const basePath = this.getDateVaultPath(date);
    const indexPath = `${basePath}/index.md`;
    
    const dateString = Utils.formatDateJapanese(date);
    const totalArticles = Object.values(processedData).reduce((sum, data) => sum + data.count, 0);
    
    const frontmatter = Utils.generateYamlFrontmatter({
      date: Utils.formatDate(date),
      type: 'index',
      total_articles: totalArticles,
      categories: Object.keys(processedData).length,
      generated: new Date().toISOString()
    });

    let content = `# RSS フィード要約 - ${dateString}\n\n`;
    content += `**総記事数**: ${totalArticles}件\n`;
    content += `**カテゴリ数**: ${Object.keys(processedData).length}件\n\n`;
    
    content += `## カテゴリ別概要\n\n`;
    
    // Sort categories by article count
    const sortedCategories = Object.entries(processedData)
      .sort(([,a], [,b]) => b.count - a.count);
    
    sortedCategories.forEach(([tag, data]) => {
      const fileName = tag.split('/').pop();
      const filePath = tag.includes('/') ? `${tag.split('/')[0]}/${fileName}.md` : `${fileName}.md`;
      
      content += `### [${tag.toUpperCase()}](${filePath}) (${data.count}件)\n\n`;
      
      if (data.summary) {
        content += `${Utils.truncate(data.summary, 150)}\n\n`;
      }
    });
    
    content += `\n---\n\n`;
    content += `*このインデックスは自動生成されました - ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}*\n`;
    
    const fullContent = frontmatter + content;
    
    await this.createObsidianFile(indexPath, fullContent);
    
    Utils.log('info', `Created index file: ${indexPath}`);
  }

  /**
   * Generate all output files in Obsidian vault
   * @param {Object} processedData 
   * @param {Date} date 
   */
  async generateOutput(processedData, date = new Date()) {
    if (!processedData || Object.keys(processedData).length === 0) {
      Utils.log('warn', 'No data to generate output');
      return;
    }

    // Test connection first
    const connected = await this.testConnection();
    if (!connected) {
      throw new Error('Cannot connect to Obsidian Local REST API. Please ensure Obsidian is running with the plugin enabled.');
    }

    await this.createAllFiles(processedData, date);
    await this.createIndexFile(processedData, date);
    
    const vaultPath = this.getDateVaultPath(date);
    Utils.log('info', `Output generation complete. Files created in Obsidian vault: ${vaultPath}`);
  }
}

module.exports = new ObsidianAPI();