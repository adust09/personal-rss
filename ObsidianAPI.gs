/**
 * ObsidianAPI.gs - RSS Feeder Obsidian Local REST API 連携
 * Obsidian Vaultへのファイル作成・フォルダ管理を行う
 */

/**
 * Obsidian API 設定
 */
const OBSIDIAN_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000, // 2秒
  TIMEOUT: 30000, // 30秒
  CHUNK_SIZE: 1000000 // 1MB（ファイルサイズ制限）
};

/**
 * タグ別にObsidianファイルを作成する
 * @param {string} tag - タグ名
 * @param {string} markdown - マークダウン内容
 * @return {boolean} 作成成功フラグ
 */
function createObsidianFile(tag, markdown) {
  const date = getCurrentDateString();
  console.log(`Obsidianファイル作成開始: ${tag} (${date})`);
  
  try {
    // ファイルパスとディレクトリパスを生成
    const filePath = generateFilePath(tag, date);
    const dirPath = generateDirectoryPath(tag, date);
    
    // 必要なディレクトリを作成
    if (!ensureDirectoryExists(dirPath)) {
      console.error(`ディレクトリ作成失敗: ${dirPath}`);
      return false;
    }
    
    // ファイルを作成
    const success = createVaultFile(filePath, markdown);
    
    if (success) {
      console.log(`ファイル作成成功: ${filePath}`);
      return true;
    } else {
      console.error(`ファイル作成失敗: ${filePath}`);
      return false;
    }
    
  } catch (error) {
    console.error(`Obsidianファイル作成エラー [${tag}]:`, error.toString());
    return false;
  }
}

/**
 * Obsidian Vaultにファイルを作成する
 * @param {string} filePath - ファイルパス
 * @param {string} content - ファイル内容
 * @return {boolean} 作成成功フラグ
 */
function createVaultFile(filePath, content) {
  const apiUrl = getObsidianApiUrl();
  const apiKey = getObsidianApiKey();
  
  if (!apiKey) {
    throw new Error('Obsidian APIキーが設定されていません');
  }
  
  // ファイルサイズチェック
  if (content.length > OBSIDIAN_CONFIG.CHUNK_SIZE) {
    console.warn(`ファイルサイズが大きすぎます: ${content.length} bytes`);
    content = truncateText(content, OBSIDIAN_CONFIG.CHUNK_SIZE - 100, '\n\n...(内容が切り詰められました)');
  }
  
  const url = `${apiUrl}/vault/${encodeURIComponent(filePath)}`;
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'text/markdown; charset=utf-8'
    },
    payload: content,
    muteHttpExceptions: true
  };
  
  return callObsidianAPIWithRetry(url, options, `ファイル作成: ${filePath}`);
}

/**
 * ディレクトリが存在することを確認し、必要に応じて作成する
 * @param {string} dirPath - ディレクトリパス
 * @return {boolean} 成功フラグ
 */
function ensureDirectoryExists(dirPath) {
  try {
    // ディレクトリパスから階層を抽出
    const pathParts = dirPath.split('/').filter(part => part !== '');
    let currentPath = '';
    
    // 段階的にディレクトリを作成
    for (const part of pathParts) {
      currentPath += part + '/';
      
      if (!checkDirectoryExists(currentPath)) {
        if (!createVaultDirectory(currentPath)) {
          console.error(`ディレクトリ作成失敗: ${currentPath}`);
          return false;
        }
        console.log(`ディレクトリ作成成功: ${currentPath}`);
      }
    }
    
    return true;
    
  } catch (error) {
    console.error(`ディレクトリ確認エラー [${dirPath}]:`, error.toString());
    return false;
  }
}

/**
 * Obsidian Vaultにディレクトリを作成する
 * @param {string} dirPath - ディレクトリパス
 * @return {boolean} 作成成功フラグ
 */
function createVaultDirectory(dirPath) {
  const apiUrl = getObsidianApiUrl();
  const apiKey = getObsidianApiKey();
  
  if (!apiKey) {
    throw new Error('Obsidian APIキーが設定されていません');
  }
  
  const url = `${apiUrl}/vault/${encodeURIComponent(dirPath)}`;
  
  const options = {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    muteHttpExceptions: true
  };
  
  return callObsidianAPIWithRetry(url, options, `ディレクトリ作成: ${dirPath}`);
}

/**
 * ディレクトリの存在を確認する
 * @param {string} dirPath - ディレクトリパス
 * @return {boolean} 存在フラグ
 */
function checkDirectoryExists(dirPath) {
  const apiUrl = getObsidianApiUrl();
  const apiKey = getObsidianApiKey();
  
  if (!apiKey) {
    return false;
  }
  
  try {
    const url = `${apiUrl}/vault/${encodeURIComponent(dirPath)}`;
    
    const options = {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    return response.getResponseCode() === 200;
    
  } catch (error) {
    return false;
  }
}

/**
 * ファイルの存在を確認する
 * @param {string} filePath - ファイルパス
 * @return {boolean} 存在フラグ
 */
function checkFileExists(filePath) {
  const apiUrl = getObsidianApiUrl();
  const apiKey = getObsidianApiKey();
  
  if (!apiKey) {
    return false;
  }
  
  try {
    const url = `${apiUrl}/vault/${encodeURIComponent(filePath)}`;
    
    const options = {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    return response.getResponseCode() === 200;
    
  } catch (error) {
    return false;
  }
}

/**
 * リトライ機能付きでObsidian APIを呼び出す
 * @param {string} url - API URL
 * @param {Object} options - リクエストオプション
 * @param {string} operation - 操作名（ログ用）
 * @return {boolean} 成功フラグ
 */
function callObsidianAPIWithRetry(url, options, operation) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= OBSIDIAN_CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`${operation} (試行 ${attempt}/${OBSIDIAN_CONFIG.MAX_RETRIES})`);
      
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      
      if (responseCode >= 200 && responseCode < 300) {
        console.log(`${operation} 成功 (HTTP ${responseCode})`);
        return true;
      } else {
        const errorMessage = `HTTP ${responseCode}: ${response.getContentText()}`;
        throw new Error(errorMessage);
      }
      
    } catch (error) {
      lastError = error;
      console.warn(`${operation} 試行 ${attempt} 失敗: ${error.toString()}`);
      
      if (attempt < OBSIDIAN_CONFIG.MAX_RETRIES) {
        const delay = OBSIDIAN_CONFIG.RETRY_DELAY * attempt;
        console.log(`${delay}ms 待機後に再試行...`);
        Utilities.sleep(delay);
      }
    }
  }
  
  console.error(`${operation} 最終失敗: ${lastError.toString()}`);
  return false;
}

/**
 * 今日の記事ファイルを全て作成する
 * @param {Object} groupedByTag - タグ別記事オブジェクト
 * @return {Object} 作成結果
 */
function createAllObsidianFiles(groupedByTag) {
  console.log('全Obsidianファイル作成開始');
  
  const results = {
    success: 0,
    failure: 0,
    skipped: 0,
    errors: []
  };
  
  const tags = Object.keys(groupedByTag);
  console.log(`処理対象タグ: ${tags.length} 個`);
  
  for (const tag of tags) {
    const articles = groupedByTag[tag];
    
    if (articles.length === 0) {
      console.log(`スキップ: ${tag} (記事数: 0)`);
      results.skipped++;
      continue;
    }
    
    try {
      console.log(`処理中: ${tag} (記事数: ${articles.length})`);
      
      // 要約生成
      const summary = generateSummary(tag, articles);
      
      // マークダウン生成
      const markdown = createCompleteMarkdown(tag, articles, summary);
      
      // Obsidianファイル作成
      const success = createObsidianFile(tag, markdown);
      
      if (success) {
        results.success++;
        console.log(`✅ ${tag}: 作成成功`);
      } else {
        results.failure++;
        results.errors.push(`${tag}: ファイル作成失敗`);
        console.error(`❌ ${tag}: 作成失敗`);
      }
      
      // レート制限対策
      Utilities.sleep(1000);
      
    } catch (error) {
      results.failure++;
      const errorMsg = `${tag}: ${error.toString()}`;
      results.errors.push(errorMsg);
      console.error(`❌ ${tag}: エラー - ${error.toString()}`);
    }
  }
  
  console.log('全Obsidianファイル作成完了');
  console.log(`結果: 成功 ${results.success}, 失敗 ${results.failure}, スキップ ${results.skipped}`);
  
  if (results.errors.length > 0) {
    console.error('エラー詳細:');
    results.errors.forEach(error => console.error(`  - ${error}`));
  }
  
  return results;
}

/**
 * 完全なマークダウン内容を生成する
 * @param {string} tag - タグ名
 * @param {Array<RssArticle>} articles - 記事配列
 * @param {string} summary - 要約
 * @return {string} 完全なマークダウン
 */
function createCompleteMarkdown(tag, articles, summary) {
  const date = getCurrentDateString();
  
  // YAMLフロントマター
  const frontmatter = generateYamlFrontmatter(tag, articles.length, date);
  
  // マークダウン本文
  const content = generateMarkdownContent(tag, articles, summary, date);
  
  return frontmatter + '\n' + content;
}

/**
 * Obsidian API 接続テスト
 */
function testObsidianConnection() {
  console.log('=== Obsidian API 接続テスト開始 ===');
  
  try {
    const apiUrl = getObsidianApiUrl();
    const apiKey = getObsidianApiKey();
    
    console.log(`API URL: ${apiUrl}`);
    console.log(`API Key: ${apiKey ? apiKey.substring(0, 4) + '****' : '未設定'}`);
    
    if (!apiKey) {
      console.error('Obsidian APIキーが設定されていません');
      return false;
    }
    
    // テストディレクトリの作成
    const testDir = 'RSS-Feeder-Test/';
    console.log(`テストディレクトリ作成: ${testDir}`);
    
    if (createVaultDirectory(testDir)) {
      console.log('✅ ディレクトリ作成成功');
      
      // テストファイルの作成
      const testFile = 'RSS-Feeder-Test/connection-test.md';
      const testContent = `# Obsidian API 接続テスト\n\n作成日時: ${new Date().toLocaleString('ja-JP')}\n\nこのファイルはRSS Feederの接続テスト用です。`;
      
      console.log(`テストファイル作成: ${testFile}`);
      
      if (createVaultFile(testFile, testContent)) {
        console.log('✅ ファイル作成成功');
        
        // ファイル存在確認
        if (checkFileExists(testFile)) {
          console.log('✅ ファイル存在確認成功');
          console.log('🎉 Obsidian API 接続テスト完了 - 全て正常');
          return true;
        } else {
          console.error('❌ ファイル存在確認失敗');
          return false;
        }
      } else {
        console.error('❌ ファイル作成失敗');
        return false;
      }
    } else {
      console.error('❌ ディレクトリ作成失敗');
      return false;
    }
    
  } catch (error) {
    console.error('接続テストエラー:', error.toString());
    return false;
  }
  
  console.log('=== Obsidian API 接続テスト完了 ===');
}

/**
 * ObsidianAPI の総合テスト
 */
function testObsidianAPI() {
  console.log('=== ObsidianAPI 総合テスト開始 ===');
  
  try {
    // 1. 接続テスト
    if (!testObsidianConnection()) {
      console.error('接続テストに失敗しました');
      return;
    }
    
    console.log('\n総合テスト完了');
    
  } catch (error) {
    console.error('総合テストエラー:', error.toString());
  }
  
  console.log('=== ObsidianAPI 総合テスト完了 ===');
}