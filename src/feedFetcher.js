/**
 * RSS Feed Fetcher
 * Replaces Google Apps Script UrlFetchApp and XmlService functionality
 */

const Parser = require('rss-parser');
const axios = require('axios');
const Utils = require('./utils');
const config = require('./config');

class FeedFetcher {
  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      maxRedirects: 3,
      customFields: {
        item: [
          ['dc:creator', 'creator'],
          ['content:encoded', 'contentEncoded'],
          ['media:thumbnail', 'thumbnail'],
          ['description', 'description']
        ]
      }
    });
  }

  /**
   * Fetch and parse an RSS feed
   * @param {string} feedUrl 
   * @returns {Promise<Object>} Parsed feed data
   */
  async fetchFeed(feedUrl) {
    try {
      Utils.log('info', `Fetching feed: ${feedUrl}`);
      
      const response = await axios.get(feedUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Personal RSS Feeder Bot/1.0'
        }
      });

      const feed = await this.parser.parseString(response.data);
      
      Utils.log('info', `Successfully fetched feed: ${feed.title} (${feed.items?.length || 0} items)`);
      
      return {
        title: feed.title,
        description: feed.description,
        link: feed.link,
        items: feed.items?.map(item => this.normalizeItem(item)) || []
      };
      
    } catch (error) {
      Utils.log('error', `Failed to fetch feed ${feedUrl}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch multiple RSS feeds concurrently with error handling
   * @param {Array<string>} feedUrls 
   * @returns {Promise<Array<Object>>} Array of feed data
   */
  async fetchMultipleFeeds(feedUrls) {
    if (!feedUrls || feedUrls.length === 0) {
      Utils.log('warn', 'No RSS feeds configured');
      return [];
    }

    Utils.log('info', `Fetching ${feedUrls.length} RSS feeds`);
    
    const feedPromises = feedUrls.map(async (feedUrl) => {
      try {
        return await Utils.retry(
          () => this.fetchFeed(feedUrl),
          config.getMaxRetries(),
          config.getRetryDelay(),
          `Feed fetch for ${feedUrl}`
        );
      } catch (error) {
        Utils.log('error', `Skipping feed ${feedUrl} due to persistent errors:`, error.message);
        return null;
      }
    });

    const results = await Promise.allSettled(feedPromises);
    
    const successfulFeeds = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);

    const failedCount = results.length - successfulFeeds.length;
    
    if (failedCount > 0) {
      Utils.log('warn', `${failedCount} feeds failed to fetch`);
    }
    
    Utils.log('info', `Successfully fetched ${successfulFeeds.length} feeds`);
    
    return successfulFeeds;
  }

  /**
   * Normalize feed item data structure
   * @param {Object} item Raw RSS item
   * @returns {Object} Normalized item
   */
  normalizeItem(item) {
    return {
      title: item.title || 'Untitled',
      link: item.link || item.guid || '',
      description: Utils.stripHtml(item.description || item.contentSnippet || ''),
      content: item.contentEncoded || item.content || '',
      pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
      creator: item.creator || item.author || '',
      categories: item.categories || [],
      guid: item.guid || item.link || ''
    };
  }

  /**
   * Filter articles by date (today's articles only)
   * @param {Array<Object>} articles 
   * @returns {Array<Object>} Today's articles
   */
  filterTodayArticles(articles) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const todayArticles = articles.filter(article => {
      const pubDate = new Date(article.pubDate);
      return pubDate >= todayStart && pubDate < todayEnd;
    });

    Utils.log('info', `Filtered ${todayArticles.length} articles from today out of ${articles.length} total`);
    
    return todayArticles;
  }

  /**
   * Get all articles from configured feeds
   * @param {boolean} todayOnly Whether to filter for today's articles only
   * @returns {Promise<Array<Object>>} All articles
   */
  async getAllArticles(todayOnly = true) {
    const feedUrls = config.getRssFeeds();
    const feeds = await this.fetchMultipleFeeds(feedUrls);
    
    let allArticles = [];
    
    for (const feed of feeds) {
      if (feed && feed.items) {
        // Add feed source to each article
        const articlesWithSource = feed.items.map(item => ({
          ...item,
          feedTitle: feed.title,
          feedLink: feed.link
        }));
        
        allArticles = allArticles.concat(articlesWithSource);
      }
    }

    Utils.log('info', `Total articles collected: ${allArticles.length}`);

    // Filter for today's articles if requested
    if (todayOnly) {
      allArticles = this.filterTodayArticles(allArticles);
    }

    // Remove duplicates based on title and link
    allArticles = this.removeDuplicates(allArticles);
    
    Utils.log('info', `Final article count after deduplication: ${allArticles.length}`);
    
    return allArticles;
  }

  /**
   * Remove duplicate articles based on title and link
   * @param {Array<Object>} articles 
   * @returns {Array<Object>} Deduplicated articles
   */
  removeDuplicates(articles) {
    const seen = new Set();
    
    return articles.filter(article => {
      const key = `${article.title}_${article.link}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

module.exports = new FeedFetcher();