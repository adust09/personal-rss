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
   * Group articles by parent tags (from feeds)
   * @param {Array<Object>} articles 
   * @returns {Object} Articles grouped by parent tags
   */
  groupArticlesByParentTags(articles) {
    const grouped = {};

    for (const article of articles) {
      const parentTag = article.feedParentTag || 'tech'; // Default to tech if not specified
      
      if (!grouped[parentTag]) {
        grouped[parentTag] = [];
      }
      grouped[parentTag].push(article);
    }

    // Sort articles in each group by publication date (newest first)
    for (const tag in grouped) {
      grouped[tag].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    }

    Utils.log('info', `Grouped articles into ${Object.keys(grouped).length} parent tag categories`);
    
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
   * Process all articles: group by parent tags and generate summaries
   * @param {Array<Object>} articles 
   * @returns {Promise<Object>} Processed data with summaries
   */
  async processArticles(articles) {
    if (!articles || articles.length === 0) {
      Utils.log('warn', 'No articles to process');
      return {};
    }

    Utils.log('info', `Starting parent tag-based processing for ${articles.length} articles`);

    // Skip individual article tagging, use parent tags from feeds
    // Group directly by parent tags
    const groupedArticles = this.groupArticlesByParentTags(articles);

    // Generate summaries for each parent tag group
    const processedData = {};

    for (const [parentTag, tagArticles] of Object.entries(groupedArticles)) {
      if (tagArticles.length === 0) {
        continue;
      }

      const summary = await this.generateSummary(parentTag, tagArticles);
      
      processedData[parentTag] = {
        articles: tagArticles,
        summary: summary,
        count: tagArticles.length
      };
    }

    Utils.log('info', `Parent tag processing complete. Generated ${Object.keys(processedData).length} parent tag summaries`);
    
    return processedData;
  }

  /**
   * Filter articles that contain any of the watch words
   * @param {Array<Object>} articles 
   * @param {Array<string>} watchWords 
   * @returns {Object} Articles grouped by keywords
   */
  filterArticlesByKeywords(articles, watchWords) {
    if (!watchWords || watchWords.length === 0) {
      return {};
    }

    const keywordArticles = {};

    for (const article of articles) {
      const title = (article.title || '').toLowerCase();
      const description = (article.description || '').toLowerCase();
      const content = title + ' ' + description;

      // Check each watch word
      for (const keyword of watchWords) {
        const keywordLower = keyword.toLowerCase();
        
        // Check if article content contains the keyword
        if (content.includes(keywordLower)) {
          if (!keywordArticles[keyword]) {
            keywordArticles[keyword] = [];
          }
          keywordArticles[keyword].push(article);
          break; // Article matched one keyword, don't check others
        }
      }
    }

    // Remove keywords with no articles
    Object.keys(keywordArticles).forEach(keyword => {
      if (keywordArticles[keyword].length === 0) {
        delete keywordArticles[keyword];
      }
    });

    Utils.log('info', `Found articles for ${Object.keys(keywordArticles).length} keywords: ${Object.keys(keywordArticles).join(', ')}`);
    
    return keywordArticles;
  }

  /**
   * Generate keyword-specific summary
   * @param {string} keyword 
   * @param {Array<Object>} articles 
   * @returns {Promise<string>} Generated summary
   */
  async generateKeywordSummary(keyword, articles) {
    if (!articles || articles.length === 0) {
      return '';
    }

    Utils.log('info', `Generating keyword summary for "${keyword}" (${articles.length} articles)`);

    const articleList = articles
      .map(article => `- ${article.title}\n  ${article.description || '説明なし'}`)
      .join('\n\n');

    // Load prompt template and replace variables
    const promptTemplate = await Utils.loadPrompt('keyword-summary.md');
    const prompt = Utils.replacePromptVariables(promptTemplate, {
      keyword: keyword,
      articleList: articleList
    });

    try {
      await Utils.sleep(this.requestDelay);
      const response = await Utils.retry(
        () => this.makeGeminiRequest(prompt),
        3,
        2000
      );
      
      const summary = response.trim();
      Utils.log('info', `Generated keyword summary for "${keyword}" (${summary.length} characters)`);
      return summary;
    } catch (error) {
      Utils.log('error', `Failed to generate keyword summary for "${keyword}": ${error.message}`);
      return `${keyword}に関する記事 ${articles.length}件を収集しました。詳細は各記事をご確認ください。`;
    }
  }

  /**
   * Process articles for keyword-based filtering and summarization
   * @param {Array<Object>} articles 
   * @returns {Promise<Object>} Processed keyword data
   */
  async processKeywordArticles(articles) {
    const config = require('./config');
    const watchWords = config.getWatchWords();

    if (!watchWords || watchWords.length === 0) {
      Utils.log('info', 'No watch words configured, skipping keyword processing');
      return {};
    }

    if (!articles || articles.length === 0) {
      Utils.log('info', 'No articles to process for keywords');
      return {};
    }

    Utils.log('info', `Starting keyword processing for ${articles.length} articles with ${watchWords.length} watch words: ${watchWords.join(', ')}`);

    // Filter articles by keywords
    const keywordArticles = this.filterArticlesByKeywords(articles, watchWords);

    if (Object.keys(keywordArticles).length === 0) {
      Utils.log('info', 'No articles matched any watch words');
      return {};
    }

    // Generate summaries for each keyword
    const processedData = {};

    for (const [keyword, keywordMatchedArticles] of Object.entries(keywordArticles)) {
      if (keywordMatchedArticles.length === 0) {
        continue;
      }

      const summary = await this.generateKeywordSummary(keyword, keywordMatchedArticles);
      
      processedData[keyword] = {
        articles: keywordMatchedArticles,
        summary: summary,
        count: keywordMatchedArticles.length
      };
    }

    Utils.log('info', `Keyword processing complete. Generated ${Object.keys(processedData).length} keyword summaries`);
    
    return processedData;
  }
}

module.exports = new LLMProcessor();