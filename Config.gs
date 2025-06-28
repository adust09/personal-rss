/**
 * Config.gs - RSS Feeder 設定管理
 * PropertiesServiceを使用してAPIキーとフィード設定を管理
 */

/**
 * 設定キーの定数定義
 */
const CONFIG_KEYS = {
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  OBSIDIAN_API_KEY: 'OBSIDIAN_API_KEY',
  OBSIDIAN_API_URL: 'OBSIDIAN_API_URL',
  RSS_FEEDS: 'RSS_FEEDS',
  OUTPUT_DIRECTORY: 'OUTPUT_DIRECTORY'
};

/**
 * デフォルト設定値
 */
const DEFAULT_CONFIG = {
  OBSIDIAN_API_URL: 'https://127.0.0.1:27123',
  OUTPUT_DIRECTORY: 'RSS'
};

/**
 * 設定値を取得する
 * @param {string} key - 設定キー
 * @param {string} defaultValue - デフォルト値（オプション）
 * @return {string|null} 設定値
 */
function getConfig(key, defaultValue = null) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const value = properties.getProperty(key);
    
    if (value === null && defaultValue !== null) {
      return defaultValue;
    }
    
    return value;
  } catch (error) {
    console.error(`設定取得エラー [${key}]:`, error.toString());
    return defaultValue;
  }
}

/**
 * 設定値を保存する
 * @param {string} key - 設定キー
 * @param {string} value - 設定値
 * @return {boolean} 保存成功フラグ
 */
function setConfig(key, value) {
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(key, value);
    console.log(`設定保存完了 [${key}]`);
    return true;
  } catch (error) {
    console.error(`設定保存エラー [${key}]:`, error.toString());
    return false;
  }
}

/**
 * 複数の設定値を一括保存する
 * @param {Object} configObj - 設定オブジェクト
 * @return {boolean} 保存成功フラグ
 */
function setBatchConfig(configObj) {
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperties(configObj);
    console.log('設定一括保存完了:', Object.keys(configObj).join(', '));
    return true;
  } catch (error) {
    console.error('設定一括保存エラー:', error.toString());
    return false;
  }
}

/**
 * Gemini APIキーを取得する
 * @return {string|null} APIキー
 */
function getGeminiApiKey() {
  return getConfig(CONFIG_KEYS.GEMINI_API_KEY);
}

/**
 * Obsidian APIキーを取得する
 * @return {string|null} APIキー
 */
function getObsidianApiKey() {
  return getConfig(CONFIG_KEYS.OBSIDIAN_API_KEY);
}

/**
 * Obsidian API URLを取得する
 * @return {string} API URL
 */
function getObsidianApiUrl() {
  return getConfig(CONFIG_KEYS.OBSIDIAN_API_URL, DEFAULT_CONFIG.OBSIDIAN_API_URL);
}

/**
 * RSSフィードURLリストを取得する
 * @return {Array<string>} フィードURLの配列
 */
function getRssFeeds() {
  try {
    const feedsJson = getConfig(CONFIG_KEYS.RSS_FEEDS);
    if (!feedsJson) {
      console.warn('RSSフィード設定が見つかりません');
      return [];
    }
    
    const feeds = JSON.parse(feedsJson);
    return Array.isArray(feeds) ? feeds : [];
  } catch (error) {
    console.error('RSSフィード解析エラー:', error.toString());
    return [];
  }
}

/**
 * 出力ディレクトリを取得する
 * @return {string} 出力ディレクトリ名
 */
function getOutputDirectory() {
  return getConfig(CONFIG_KEYS.OUTPUT_DIRECTORY, DEFAULT_CONFIG.OUTPUT_DIRECTORY);
}

/**
 * 設定値の検証を行う
 * @return {Object} 検証結果オブジェクト
 */
function validateConfig() {
  const result = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Gemini APIキーの検証
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    result.isValid = false;
    result.errors.push('Gemini APIキーが設定されていません');
  } else if (geminiKey.length < 10) {
    result.warnings.push('Gemini APIキーが短すぎる可能性があります');
  }

  // Obsidian APIキーの検証
  const obsidianKey = getObsidianApiKey();
  if (!obsidianKey) {
    result.isValid = false;
    result.errors.push('Obsidian APIキーが設定されていません');
  }

  // Obsidian API URLの検証
  const obsidianUrl = getObsidianApiUrl();
  if (!obsidianUrl.startsWith('https://')) {
    result.warnings.push('Obsidian API URLがHTTPSではありません');
  }

  // RSSフィードの検証
  const feeds = getRssFeeds();
  if (feeds.length === 0) {
    result.isValid = false;
    result.errors.push('RSSフィードが設定されていません');
  } else {
    feeds.forEach((feed, index) => {
      if (!feed.startsWith('http://') && !feed.startsWith('https://')) {
        result.warnings.push(`フィード${index + 1}のURLが無効です: ${feed}`);
      }
    });
  }

  return result;
}

/**
 * 設定情報を表示する（デバッグ用）
 * APIキーは先頭4文字のみ表示
 */
function displayConfig() {
  console.log('=== RSS Feeder 設定情報 ===');
  
  const geminiKey = getGeminiApiKey();
  console.log('Gemini APIキー:', geminiKey ? `${geminiKey.substring(0, 4)}****` : '未設定');
  
  const obsidianKey = getObsidianApiKey();
  console.log('Obsidian APIキー:', obsidianKey ? `${obsidianKey.substring(0, 4)}****` : '未設定');
  
  console.log('Obsidian API URL:', getObsidianApiUrl());
  console.log('出力ディレクトリ:', getOutputDirectory());
  
  const feeds = getRssFeeds();
  console.log('RSSフィード数:', feeds.length);
  feeds.forEach((feed, index) => {
    console.log(`  ${index + 1}. ${feed}`);
  });
  
  console.log('========================');
}

/**
 * 初期設定を行う
 * 初回セットアップ時に使用
 */
function initializeConfig() {
  console.log('RSS Feeder 初期設定を開始します');
  
  // サンプル設定
  const sampleConfig = {};
  sampleConfig[CONFIG_KEYS.OBSIDIAN_API_URL] = DEFAULT_CONFIG.OBSIDIAN_API_URL;
  sampleConfig[CONFIG_KEYS.OUTPUT_DIRECTORY] = DEFAULT_CONFIG.OUTPUT_DIRECTORY;
  sampleConfig[CONFIG_KEYS.RSS_FEEDS] = JSON.stringify([
    'https://feeds.feedburner.com/oreilly/radar/tech',
    'https://techcrunch.com/feed/'
  ]);
  
  if (setBatchConfig(sampleConfig)) {
    console.log('初期設定完了');
    console.log('以下の設定を手動で追加してください:');
    console.log('- GEMINI_API_KEY: あなたのGemini APIキー');
    console.log('- OBSIDIAN_API_KEY: あなたのObsidian APIキー');
  } else {
    console.error('初期設定に失敗しました');
  }
}

/**
 * 設定をリセットする
 * 注意: 全ての設定が削除されます
 */
function resetConfig() {
  try {
    const properties = PropertiesService.getScriptProperties();
    
    // 全設定キーを削除
    Object.values(CONFIG_KEYS).forEach(key => {
      properties.deleteProperty(key);
    });
    
    console.log('設定リセット完了');
  } catch (error) {
    console.error('設定リセットエラー:', error.toString());
  }
}