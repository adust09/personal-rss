/**
 * Obsidian Local REST API連携クラス
 * Obsidian Local REST APIプラグインを使用してファイルとフォルダの作成・管理を行う
 */
class ObsidianAPI {
  
  constructor() {
    this.baseUrl = PropertiesService.getScriptProperties().getProperty('obsidian_api_url') || 'https://127.0.0.1:27123';
    this.apiKey = PropertiesService.getScriptProperties().getProperty('obsidian_api_key');
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒
    
    if (!this.apiKey) {
      throw new Error('Obsidian APIキーが設定されていません。PropertiesServiceで obsidian_api_key を設定してください。');
    }
  }
  
  /**
   * ファイルを作成または更新する
   * @param {string} filePath - ファイルパス（vault内の相対パス）
   * @param {string} content - ファイルの内容
   * @return {boolean} 成功した場合true
   */
  createFile(filePath, content) {
    const endpoint = '/vault/' + encodeURIComponent(filePath);
    const payload = {
      content: content
    };
    
    return this._makeRequest('PUT', endpoint, payload, 'ファイル作成');
  }
  
  /**
   * フォルダを作成する
   * @param {string} folderPath - フォルダパス（vault内の相対パス）
   * @return {boolean} 成功した場合true
   */
  createFolder(folderPath) {
    const endpoint = '/vault/' + encodeURIComponent(folderPath);
    
    return this._makeRequest('PUT', endpoint, null, 'フォルダ作成');
  }
  
  /**
   * ファイルまたはフォルダの存在を確認する
   * @param {string} path - 確認するパス（vault内の相対パス）
   * @return {boolean} 存在する場合true
   */
  fileExists(path) {
    const endpoint = '/vault/' + encodeURIComponent(path);
    
    try {
      const response = this._makeRequest('GET', endpoint, null, 'ファイル存在確認', false);
      return response !== null;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * ファイル情報を取得する
   * @param {string} filePath - ファイルパス（vault内の相対パス）
   * @return {Object|null} ファイル情報または null
   */
  getFileInfo(filePath) {
    const endpoint = '/vault/' + encodeURIComponent(filePath);
    
    return this._makeRequest('GET', endpoint, null, 'ファイル情報取得', false);
  }
  
  /**
   * 階層フォルダ構造を作成する
   * @param {string} fullPath - 作成するファイルの完全パス
   */
  ensureDirectoryStructure(fullPath) {
    const pathParts = fullPath.split('/');
    pathParts.pop(); // ファイル名を除去
    
    let currentPath = '';
    for (const part of pathParts) {
      if (part.trim() === '') continue;
      
      currentPath = currentPath ? currentPath + '/' + part : part;
      
      if (!this.fileExists(currentPath)) {
        console.log(`フォルダを作成中: ${currentPath}`);
        this.createFolder(currentPath);
      }
    }
  }
  
  /**
   * HTTP リクエストを実行する（リトライ機能付き）
   * @param {string} method - HTTPメソッド
   * @param {string} endpoint - APIエンドポイント
   * @param {Object} payload - リクエストボディ
   * @param {string} operation - 操作名（ログ用）
   * @param {boolean} throwOnError - エラー時に例外を投げるかどうか
   * @return {Object|null} レスポンスデータまたは null
   */
  _makeRequest(method, endpoint, payload = null, operation = 'API呼び出し', throwOnError = true) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const url = this.baseUrl + endpoint;
        const options = {
          method: method,
          headers: {
            'Authorization': 'Bearer ' + this.apiKey,
            'Content-Type': 'application/json'
          },
          muteHttpExceptions: true
        };
        
        if (payload && (method === 'PUT' || method === 'POST')) {
          options.payload = JSON.stringify(payload);
        }
        
        console.log(`${operation} (試行 ${attempt}/${this.maxRetries}): ${method} ${url}`);
        
        const response = UrlFetchApp.fetch(url, options);
        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();
        
        if (responseCode >= 200 && responseCode < 300) {
          console.log(`${operation} 成功: HTTP ${responseCode}`);
          
          if (responseText) {
            try {
              return JSON.parse(responseText);
            } catch (parseError) {
              return responseText;
            }
          }
          return true;
        } else {
          throw new Error(`HTTP ${responseCode}: ${responseText}`);
        }
        
      } catch (error) {
        lastError = error;
        console.warn(`${operation} 失敗 (試行 ${attempt}/${this.maxRetries}): ${error.message}`);
        
        if (attempt < this.maxRetries) {
          console.log(`${this.retryDelay}ms 待機してリトライします...`);
          Utilities.sleep(this.retryDelay);
        }
      }
    }
    
    const errorMessage = `${operation} が ${this.maxRetries} 回試行しても失敗しました: ${lastError.message}`;
    console.error(errorMessage);
    
    if (throwOnError) {
      throw new Error(errorMessage);
    }
    
    return null;
  }
  
  /**
   * APIの接続をテストする
   * @return {boolean} 接続成功の場合true
   */
  testConnection() {
    try {
      console.log('Obsidian API接続テストを開始...');
      
      // ルートディレクトリの情報を取得してAPIの動作確認
      const response = this._makeRequest('GET', '/vault', null, '接続テスト', false);
      
      if (response !== null) {
        console.log('Obsidian API接続テスト成功');
        return true;
      } else {
        console.error('Obsidian API接続テスト失敗');
        return false;
      }
    } catch (error) {
      console.error(`Obsidian API接続エラー: ${error.message}`);
      return false;
    }
  }
}

/**
 * ObsidianAPIインスタンスを取得する
 * @return {ObsidianAPI} ObsidianAPIインスタンス
 */
function getObsidianAPI() {
  return new ObsidianAPI();
}