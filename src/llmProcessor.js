/**
 * LLM Processor for Gemini API integration
 * Handles article tagging and summarization
 */

const axios = require('axios');
const Utils = require('./utils');
const config = require('./config');

class LLMProcessor {
  constructor() {
    this.apiKey = config.getGeminiApiKey();
    this.model = config.getGeminiModel();
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    this.requestDelay = config.getGeminiRequestDelay();
  }

  /**
   * Make a request to Gemini API with retry logic
   * @param {string} prompt 
   * @returns {Promise<string>} API response text
   */
  async makeGeminiRequest(prompt) {
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}?key=${this.apiKey}`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return response.data.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Invalid response format from Gemini API');
      }
    } catch (error) {
      if (error.response) {
        Utils.log('error', `Gemini API error ${error.response.status}:`, error.response.data);
      } else {
        Utils.log('error', 'Gemini API request failed:', error.message);
      }
      throw error;
    }
  }

  /**
   * Tag articles with hierarchical categories
   * @param {Array<Object>} articles 
   * @returns {Promise<Array<Object>>} Articles with tags
   */
  async tagArticles(articles) {
    if (!articles || articles.length === 0) {
      Utils.log('warn', 'No articles to tag');
      return [];
    }

    Utils.log('info', `Tagging ${articles.length} articles`);

    const taggedArticles = [];

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      try {
        // Rate limiting
        if (i > 0) {
          await Utils.sleep(this.requestDelay);
        }

        const tags = await this.getArticleTags(article);
        
        taggedArticles.push({
          ...article,
          tags: tags
        });

        Utils.log('info', `Tagged article ${i + 1}/${articles.length}: "${Utils.truncate(article.title)}" -> [${tags.join(', ')}]`);
        
      } catch (error) {
        Utils.log('error', `Failed to tag article "${Utils.truncate(article.title)}":`, error.message);
        
        // Add article with fallback tag
        taggedArticles.push({
          ...article,
          tags: ['uncategorized']
        });
      }
    }

    Utils.log('info', `Successfully tagged ${taggedArticles.length} articles`);
    return taggedArticles;
  }

  /**
   * Get tags for a single article
   * @param {Object} article 
   * @returns {Promise<Array<string>>} Array of tags
   */
  async getArticleTags(article) {
    // Load prompt template and replace variables
    const promptTemplate = await Utils.loadPrompt('tagging.md');
    const prompt = Utils.replacePromptVariables(promptTemplate, {
      title: article.title,
      description: article.description,
      categories: article.categories?.join(', ') || 'なし'
    });

    const response = await Utils.retry(
      () => this.makeGeminiRequest(prompt),
      config.getMaxRetries(),
      config.getRetryDelay(),
      `Tagging article: ${Utils.truncate(article.title)}`
    );

    // Parse tags from response
    const tags = response
      .trim()
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0)
      .slice(0, 3); // Limit to 3 tags max

    return tags.length > 0 ? tags : ['uncategorized'];
  }

  /**
   * Group articles by tags
   * @param {Array<Object>} taggedArticles 
   * @returns {Object} Articles grouped by tags
   */
  groupArticlesByTags(taggedArticles) {
    const grouped = {};

    for (const article of taggedArticles) {
      for (const tag of article.tags) {
        if (!grouped[tag]) {
          grouped[tag] = [];
        }
        grouped[tag].push(article);
      }
    }

    // Sort articles in each group by publication date (newest first)
    for (const tag in grouped) {
      grouped[tag].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    }

    Utils.log('info', `Grouped articles into ${Object.keys(grouped).length} categories`);
    
    return grouped;
  }

  /**
   * Generate Japanese summary for a group of articles
   * @param {string} tag 
   * @param {Array<Object>} articles 
   * @returns {Promise<string>} Japanese summary
   */
  async generateSummary(tag, articles) {
    if (!articles || articles.length === 0) {
      return '';
    }

    const articleList = articles
      .slice(0, 10) // Limit to top 10 articles to avoid token limits
      .map(article => `- ${article.title}\n  ${article.description || '説明なし'}`)
      .join('\n\n');

    // Load prompt template and replace variables
    const promptTemplate = await Utils.loadPrompt('summarization.md');
    const prompt = Utils.replacePromptVariables(promptTemplate, {
      tag: tag,
      articleList: articleList
    });

    try {
      await Utils.sleep(this.requestDelay);
      
      const summary = await Utils.retry(
        () => this.makeGeminiRequest(prompt),
        config.getMaxRetries(),
        config.getRetryDelay(),
        `Generating summary for tag: ${tag}`
      );

      Utils.log('info', `Generated summary for ${tag} (${articles.length} articles)`);
      
      return summary.trim();
      
    } catch (error) {
      Utils.log('error', `Failed to generate summary for ${tag}:`, error.message);
      return `${tag}カテゴリの記事 ${articles.length}件を収集しました。詳細は各記事をご確認ください。`;
    }
  }

  /**
   * Process all articles: tag and generate summaries
   * @param {Array<Object>} articles 
   * @returns {Promise<Object>} Processed data with summaries
   */
  async processArticles(articles) {
    if (!articles || articles.length === 0) {
      Utils.log('warn', 'No articles to process');
      return {};
    }

    Utils.log('info', `Starting LLM processing for ${articles.length} articles`);

    // Step 1: Tag articles
    const taggedArticles = await this.tagArticles(articles);

    // Step 2: Group by tags
    const groupedArticles = this.groupArticlesByTags(taggedArticles);

    // Step 3: Generate summaries for each group
    const processedData = {};

    for (const [tag, tagArticles] of Object.entries(groupedArticles)) {
      if (tagArticles.length === 0) {
        continue;
      }

      const summary = await this.generateSummary(tag, tagArticles);
      
      processedData[tag] = {
        articles: tagArticles,
        summary: summary,
        count: tagArticles.length
      };
    }

    Utils.log('info', `LLM processing complete. Generated ${Object.keys(processedData).length} category summaries`);
    
    return processedData;
  }
}

module.exports = new LLMProcessor();