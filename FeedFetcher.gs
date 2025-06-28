/**
 * FeedFetcher.gs - RSS Feeder フィード取得機能
 * UrlFetchAppとXmlServiceを使用してRSSフィードを取得・解析
 */

/**
 * RSSフィード記事の型定義（JSDoc用）
 * @typedef {Object} RssArticle
 * @property {string} title - 記事タイトル
 * @property {string} link - 記事URL
 * @property {string} description - 記事説明
 * @property {Date} pubDate - 公開日
 * @property {string} guid - 記事の一意識別子
 * @property {string} feedUrl - 元フィードURL
 * @property {string} feedTitle - フィードタイトル
 */

/**
 * 全てのRSSフィードを取得する
 * @return {Array<RssArticle>} 全記事の配列
 */
function fetchAllFeeds() {
  console.log('RSS フィード取得開始');
  
  const feeds = getRssFeeds();
  if (feeds.length === 0) {
    console.warn('RSSフィードが設定されていません');
    return [];
  }
  
  const allArticles = [];
  let successCount = 0;
  let failureCount = 0;
  
  feeds.forEach((feedUrl, index) => {
    console.log(`フィード ${index + 1}/${feeds.length} を取得中: ${feedUrl}`);
    
    try {
      const articles = fetchSingleFeed(feedUrl);
      if (articles.length > 0) {
        allArticles.push(...articles);
        successCount++;
        console.log(`  → ${articles.length} 件の記事を取得`);
      } else {
        console.warn(`  → 記事が見つかりませんでした`);
        failureCount++;
      }
    } catch (error) {
      console.error(`  → フィード取得エラー:`, error.toString());
      failureCount++;
    }
    
    // レート制限対策：少し待機
    if (index < feeds.length - 1) {
      Utilities.sleep(500);
    }
  });
  
  console.log(`フィード取得完了: 成功 ${successCount} 件, 失敗 ${failureCount} 件, 総記事数 ${allArticles.length} 件`);
  
  // 公開日でソート（新しい順）
  allArticles.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
  
  return allArticles;
}

/**
 * 単一のRSSフィードを取得・解析する
 * @param {string} feedUrl - フィードURL
 * @return {Array<RssArticle>} 記事の配列
 */
function fetchSingleFeed(feedUrl) {
  try {
    // RSS フィードを取得
    const response = UrlFetchApp.fetch(feedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'RSS-Feeder-GAS/1.0'
      },
      muteHttpExceptions: true
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`HTTPエラー: ${response.getResponseCode()} - ${response.getContentText()}`);
    }
    
    const xmlContent = response.getContentText();
    return parseRssXml(xmlContent, feedUrl);
    
  } catch (error) {
    console.error(`フィード取得エラー [${feedUrl}]:`, error.toString());
    throw error;
  }
}

/**
 * RSS XMLを解析して記事データに変換する
 * @param {string} xmlContent - RSS XML内容
 * @param {string} feedUrl - 元フィードURL
 * @return {Array<RssArticle>} 記事の配列
 */
function parseRssXml(xmlContent, feedUrl) {
  try {
    const document = XmlService.parse(xmlContent);
    const root = document.getRootElement();
    
    // RSS 2.0 と Atom フィードの両方に対応
    if (root.getName() === 'rss') {
      return parseRss2Feed(root, feedUrl);
    } else if (root.getName() === 'feed') {
      return parseAtomFeed(root, feedUrl);
    } else {
      throw new Error(`サポートされていないフィード形式: ${root.getName()}`);
    }
    
  } catch (error) {
    console.error(`XML解析エラー [${feedUrl}]:`, error.toString());
    throw error;
  }
}

/**
 * RSS 2.0 フィードを解析する
 * @param {XmlService.Element} root - ルート要素
 * @param {string} feedUrl - 元フィードURL
 * @return {Array<RssArticle>} 記事の配列
 */
function parseRss2Feed(root, feedUrl) {
  const articles = [];
  
  try {
    const channel = root.getChild('channel');
    if (!channel) {
      throw new Error('channel要素が見つかりません');
    }
    
    const feedTitle = getElementText(channel, 'title') || 'タイトル不明';
    const items = channel.getChildren('item');
    
    items.forEach(item => {
      try {
        const article = {
          title: getElementText(item, 'title') || 'タイトル不明',
          link: getElementText(item, 'link') || '',
          description: cleanDescription(getElementText(item, 'description') || ''),
          pubDate: parseDate(getElementText(item, 'pubDate')),
          guid: getElementText(item, 'guid') || '',
          feedUrl: feedUrl,
          feedTitle: feedTitle
        };
        
        // 必須フィールドの検証
        if (article.title && article.link) {
          articles.push(article);
        }
      } catch (error) {
        console.warn(`記事解析エラー:`, error.toString());
      }
    });
    
  } catch (error) {
    console.error(`RSS 2.0 解析エラー:`, error.toString());
    throw error;
  }
  
  return articles;
}

/**
 * Atom フィードを解析する
 * @param {XmlService.Element} root - ルート要素
 * @param {string} feedUrl - 元フィードURL
 * @return {Array<RssArticle>} 記事の配列
 */
function parseAtomFeed(root, feedUrl) {
  const articles = [];
  
  try {
    const namespace = XmlService.getNamespace('http://www.w3.org/2005/Atom');
    const feedTitle = getElementTextWithNamespace(root, 'title', namespace) || 'タイトル不明';
    const entries = root.getChildren('entry', namespace);
    
    entries.forEach(entry => {
      try {
        const linkElement = entry.getChild('link', namespace);
        const link = linkElement ? linkElement.getAttribute('href').getValue() : '';
        
        const article = {
          title: getElementTextWithNamespace(entry, 'title', namespace) || 'タイトル不明',
          link: link,
          description: cleanDescription(getElementTextWithNamespace(entry, 'summary', namespace) || ''),
          pubDate: parseDate(getElementTextWithNamespace(entry, 'published', namespace) || getElementTextWithNamespace(entry, 'updated', namespace)),
          guid: getElementTextWithNamespace(entry, 'id', namespace) || '',
          feedUrl: feedUrl,
          feedTitle: feedTitle
        };
        
        // 必須フィールドの検証
        if (article.title && article.link) {
          articles.push(article);
        }
      } catch (error) {
        console.warn(`記事解析エラー:`, error.toString());
      }
    });
    
  } catch (error) {
    console.error(`Atom フィード解析エラー:`, error.toString());
    throw error;
  }
  
  return articles;
}

/**
 * XML要素からテキストを取得する
 * @param {XmlService.Element} parent - 親要素
 * @param {string} childName - 子要素名
 * @return {string|null} テキスト内容
 */
function getElementText(parent, childName) {
  try {
    const child = parent.getChild(childName);
    return child ? child.getText() : null;
  } catch (error) {
    return null;
  }
}

/**
 * 名前空間付きXML要素からテキストを取得する
 * @param {XmlService.Element} parent - 親要素
 * @param {string} childName - 子要素名
 * @param {XmlService.Namespace} namespace - 名前空間
 * @return {string|null} テキスト内容
 */
function getElementTextWithNamespace(parent, childName, namespace) {
  try {
    const child = parent.getChild(childName, namespace);
    return child ? child.getText() : null;
  } catch (error) {
    return null;
  }
}

/**
 * 日付文字列をDateオブジェクトに変換する
 * @param {string} dateString - 日付文字列
 * @return {Date} Dateオブジェクト
 */
function parseDate(dateString) {
  if (!dateString) {
    return new Date();
  }
  
  try {
    // RFC 2822 形式やISO 8601形式に対応
    const date = new Date(dateString);
    
    // 無効な日付の場合は現在日時を返す
    if (isNaN(date.getTime())) {
      console.warn(`無効な日付形式: ${dateString}`);
      return new Date();
    }
    
    return date;
  } catch (error) {
    console.warn(`日付解析エラー: ${dateString}`, error.toString());
    return new Date();
  }
}

/**
 * 記事説明文をクリーンアップする
 * @param {string} description - 元の説明文
 * @return {string} クリーンアップされた説明文
 */
function cleanDescription(description) {
  if (!description) {
    return '';
  }
  
  try {
    // HTMLタグを除去
    let cleaned = description.replace(/<[^>]*>/g, '');
    
    // HTML エンティティをデコード
    cleaned = cleaned
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    
    // 改行文字を正規化
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // 連続する空白を単一のスペースに
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // 前後の空白を除去
    cleaned = cleaned.trim();
    
    // 長すぎる場合は切り詰め
    if (cleaned.length > 500) {
      cleaned = cleaned.substring(0, 497) + '...';
    }
    
    return cleaned;
  } catch (error) {
    console.warn('説明文クリーンアップエラー:', error.toString());
    return description;
  }
}

/**
 * 今日の記事のみをフィルタリングする
 * @param {Array<RssArticle>} articles - 全記事配列
 * @return {Array<RssArticle>} 今日の記事配列
 */
function filterTodayArticles(articles) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  
  return articles.filter(article => {
    return article.pubDate >= todayStart && article.pubDate < todayEnd;
  });
}

/**
 * 重複記事を除去する
 * @param {Array<RssArticle>} articles - 記事配列
 * @return {Array<RssArticle>} 重複除去後の記事配列
 */
function removeDuplicateArticles(articles) {
  const seen = new Set();
  const uniqueArticles = [];
  
  articles.forEach(article => {
    // タイトルとURLの組み合わせで重複判定
    const key = `${article.title}-${article.link}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueArticles.push(article);
    }
  });
  
  console.log(`重複除去: ${articles.length} → ${uniqueArticles.length} 件`);
  return uniqueArticles;
}

/**
 * フィード取得のテスト関数
 */
function testFeedFetcher() {
  console.log('=== Feed Fetcher テスト開始 ===');
  
  try {
    // 設定検証
    const validation = validateConfig();
    if (!validation.isValid) {
      console.error('設定エラー:', validation.errors.join(', '));
      return;
    }
    
    // フィード取得テスト
    const articles = fetchAllFeeds();
    console.log(`取得記事数: ${articles.length}`);
    
    if (articles.length > 0) {
      console.log('最新記事:');
      console.log(`  タイトル: ${articles[0].title}`);
      console.log(`  URL: ${articles[0].link}`);
      console.log(`  公開日: ${articles[0].pubDate}`);
      console.log(`  フィード: ${articles[0].feedTitle}`);
    }
    
    // 今日の記事のみテスト
    const todayArticles = filterTodayArticles(articles);
    console.log(`今日の記事数: ${todayArticles.length}`);
    
    // 重複除去テスト
    const uniqueArticles = removeDuplicateArticles(articles);
    console.log(`重複除去後: ${uniqueArticles.length}`);
    
  } catch (error) {
    console.error('テストエラー:', error.toString());
  }
  
  console.log('=== Feed Fetcher テスト完了 ===');
}