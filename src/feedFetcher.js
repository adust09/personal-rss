/**
 * RSS Feed Fetcher
 * Handles RSS feed retrieval and parsing
 */

const Parser = require('rss-parser');
const axios = require('axios');
const Utils = require('./utils');
const config = require('./config');
const { TIMEOUT, HTTP, DEFAULTS, TIME } = require('./constants');

class FeedFetcher {
  constructor() {
    this.parser = new Parser({
      timeout: TIMEOUT.RSS_PARSER,
      maxRedirects: HTTP.MAX_REDIRECTS,
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
        timeout: TIMEOUT.HTTP_REQUEST,
        headers: {
          'User-Agent': HTTP.USER_AGENT
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
      title: item.title || DEFAULTS.ARTICLE_TITLE,
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
   * Filter articles by date (past 1 day articles)
   * @param {Array<Object>} articles 
   * @returns {Array<Object>} Past 1 day articles
   */
  filterTodayArticles(articles) {
    const today = new Date();
    const oneDayAgo = new Date(today.getTime() - TIME.ONE_DAY_MILLISECONDS);
    const oneDayAgoStart = new Date(oneDayAgo.getFullYear(), oneDayAgo.getMonth(), oneDayAgo.getDate());

    const recentArticles = articles.filter(article => {
      const pubDate = new Date(article.pubDate);
      return pubDate >= oneDayAgoStart;
    });

    Utils.log('info', `Filtered ${recentArticles.length} articles from past 1 day out of ${articles.length} total`);
    
    return recentArticles;
  }

  /**
   * Get all articles from configured feeds
   * @param {boolean} todayOnly Whether to filter for today's articles only
   * @returns {Promise<Array<Object>>} All articles
   */
  async getAllArticles(todayOnly = true) {
    const feedsWithTags = config.getRssFeedsWithTags();
    const feedUrls = feedsWithTags.map(f => f.url);
    const feeds = await this.fetchMultipleFeeds(feedUrls);
    
    let allArticles = [];
    
    for (let i = 0; i < feeds.length; i++) {
      const feed = feeds[i];
      const feedConfig = feedsWithTags[i];
      
      if (feed && feed.items) {
        // Add feed source and parentTag to each article
        const articlesWithSource = feed.items.map(item => ({
          ...item,
          feedTitle: feed.title,
          feedLink: feed.link,
          feedParentTag: feedConfig.parentTag,
          feedName: feedConfig.name
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