/**
 * File Output System (replacing Obsidian API)
 * Creates markdown files with YAML frontmatter for processed articles
 */

const path = require('path');
const Utils = require('./utils');
const config = require('./config');

class FileOutput {
  constructor() {
    this.outputDir = config.getOutputDirectory();
  }

  /**
   * Create directory structure for the given date
   * @param {Date} date 
   * @returns {string} Base directory path
   */
  async createDateDirectory(date = new Date()) {
    const dateString = Utils.formatDate(date);
    const baseDir = path.join(this.outputDir, 'RSS', dateString);
    
    await Utils.ensureDirectory(baseDir);
    
    return baseDir;
  }

  /**
   * Create markdown file for a tag category
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

    const baseDir = await this.createDateDirectory(date);
    
    // Handle hierarchical tags (e.g., tech/ai -> tech directory)
    const tagParts = tag.split('/');
    const fileName = `${tagParts[tagParts.length - 1]}.md`;
    
    let filePath;
    if (tagParts.length > 1) {
      // Create subdirectory for hierarchical tags
      const subDir = path.join(baseDir, tagParts[0]);
      await Utils.ensureDirectory(subDir);
      filePath = path.join(subDir, fileName);
    } else {
      filePath = path.join(baseDir, fileName);
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
    
    await Utils.writeFile(filePath, fullContent);
    
    Utils.log('info', `Created file: ${filePath} (${count} articles)`);
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
    const baseDir = await this.createDateDirectory(date);
    const indexPath = path.join(baseDir, 'index.md');
    
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
    
    await Utils.writeFile(indexPath, fullContent);
    
    Utils.log('info', `Created index file: ${indexPath}`);
  }

  /**
   * Generate all output files
   * @param {Object} processedData 
   * @param {Date} date 
   */
  async generateOutput(processedData, date = new Date()) {
    if (!processedData || Object.keys(processedData).length === 0) {
      Utils.log('warn', 'No data to generate output');
      return;
    }

    await this.createAllFiles(processedData, date);
    await this.createIndexFile(processedData, date);
    
    Utils.log('info', `Output generation complete. Files created in: ${this.outputDir}`);
  }
}

module.exports = new FileOutput();