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
    const prompt = `以下の記事のタイトルと内容を分析して、適切なタグを付けてください。
利用可能なタグ:
- tech (テクノロジー全般)
- ai (人工知能、機械学習、LLM関連)
- web (ウェブ開発、フロントエンド、バックエンド)
- mobile (モバイル開発、iOS、Android)
- devops (DevOps、インフラ、クラウド)
- security (セキュリティ、暗号化、プライバシー)
- programming (プログラミング言語、フレームワーク)
- data (データサイエンス、データベース、ビッグデータ)
- hardware (ハードウェア、IoT、半導体)
- business (ビジネス、経営、マーケティング)
- science (科学、研究、学術)
- lifestyle (ライフスタイル、健康、エンターテイメント)
- news (ニュース、時事、政治)
- finance (金融、投資、暗号通貨)
- education (教育、学習、スキル開発)

記事情報:
タイトル: ${article.title}
説明: ${article.description}
カテゴリ: ${article.categories?.join(', ') || 'なし'}

最も適切なタグを1-4個選んで、カンマ区切りで返してください。タグのみを返し、他の説明は不要です。`;

    const response = await Utils.retry(
      () => this.makeGeminiRequest(prompt),
      config.getMaxRetries(),
      config.getRetryDelay(),
      `Tagging article: ${Utils.truncate(article.title)}`
    );

    // Parse tags from response and split hierarchical tags
    const rawTags = response
      .trim()
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
    
    // Split hierarchical tags (e.g., "tech/ai" -> ["tech", "ai"])
    const tags = [];
    rawTags.forEach(tag => {
      if (tag.includes('/')) {
        // Split hierarchical tags
        const parts = tag.split('/').map(part => part.trim()).filter(part => part.length > 0);
        tags.push(...parts);
      } else {
        tags.push(tag);
      }
    });
    
    // Remove duplicates and limit to 4 tags max
    const uniqueTags = [...new Set(tags)].slice(0, 4);

    return uniqueTags.length > 0 ? uniqueTags : ['uncategorized'];
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

    const prompt = `以下の「${tag}」カテゴリの記事群について、日本語で簡潔な要約を作成してください。

記事一覧:
${articleList}

要約の要件:
- 日本語で記述
- 200-300文字程度
- 主要なトピックやトレンドを含める
- 読者にとって有用な洞察を提供
- 記事のタイトルは含めない（内容の要約のみ）

要約:`;

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