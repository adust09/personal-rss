/**
 * Performance.gs - RSS Feeder パフォーマンス最適化とエラーハンドリング強化
 * GAS実行制限対応、メモリ管理、バッチ処理最適化
 */

/**
 * パフォーマンス監視データ
 */
const PERFORMANCE_MONITOR = {
  memoryUsage: [],
  executionTimes: {},
  apiCallCounts: {
    gemini: 0,
    obsidian: 0,
    rss: 0
  },
  errors: [],
  warnings: []
};

/**
 * GAS実行制限設定
 */
const GAS_LIMITS = {
  MAX_EXECUTION_TIME: 5.5 * 60 * 1000, // 5.5分（余裕を持たせる）
  MAX_MEMORY_USAGE: 100 * 1024 * 1024, // 100MB（推定）
  MAX_API_CALLS_PER_MINUTE: 60,
  BATCH_SIZE: 5,
  SAFETY_MARGIN: 30 * 1000 // 30秒の余裕
};

/**
 * 実行時間監視付きでメイン処理を実行
 * @return {boolean} 実行成功フラグ
 */
function mainWithTimeLimit() {
  const startTime = Date.now();
  console.log('⏱️ 時間制限付きメイン処理開始');
  
  try {
    // 実行時間監視を開始
    const timeMonitor = startExecutionTimeMonitor();
    
    // メイン処理実行
    main();
    
    // 監視停止
    clearInterval(timeMonitor);
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ 処理完了: ${Math.round(executionTime / 1000)}秒`);
    
    return true;
    
  } catch (error) {
    if (error.message.includes('実行時間制限')) {
      console.error('❌ 実行時間制限により処理を中断しました');
      logPerformanceSummary();
    } else {
      console.error(`❌ 処理エラー: ${error.toString()}`);
    }
    
    return false;
  }
}

/**
 * 実行時間監視を開始
 * @return {number} インターバルID
 */
function startExecutionTimeMonitor() {
  const startTime = Date.now();
  
  return setInterval(() => {
    const currentTime = Date.now();
    const elapsedTime = currentTime - startTime;
    
    if (elapsedTime > GAS_LIMITS.MAX_EXECUTION_TIME) {
      console.warn(`⚠️ 実行時間制限に達しました: ${Math.round(elapsedTime / 1000)}秒`);
      throw new Error('実行時間制限: 処理を安全に停止します');
    }
    
    // 5分経過で警告
    if (elapsedTime > 5 * 60 * 1000) {
      console.warn('⚠️ 実行時間が5分を超過しました。間もなく制限に達します。');
    }
    
  }, 30000); // 30秒ごとにチェック
}

/**
 * メモリ使用量を監視する
 */
function monitorMemoryUsage() {
  try {
    // GASではメモリ使用量の直接取得ができないため、推定値を使用
    const approximateMemory = estimateMemoryUsage();
    PERFORMANCE_MONITOR.memoryUsage.push({
      timestamp: Date.now(),
      usage: approximateMemory
    });
    
    if (approximateMemory > GAS_LIMITS.MAX_MEMORY_USAGE * 0.8) {
      console.warn(`⚠️ メモリ使用量が閾値に近づいています: ${Math.round(approximateMemory / 1024 / 1024)}MB`);
      performMemoryCleanup();
    }
    
  } catch (error) {
    console.warn(`メモリ監視エラー: ${error.toString()}`);
  }
}

/**
 * メモリ使用量を推定する
 * @return {number} 推定メモリ使用量（バイト）
 */
function estimateMemoryUsage() {
  // 簡易的な推定（実際の使用量ではない）
  const baseUsage = 10 * 1024 * 1024; // 10MB基本使用量
  const articleCount = EXECUTION_STATS.processedArticles || 0;
  const articleMemory = articleCount * 1024; // 記事1件あたり1KB推定
  
  return baseUsage + articleMemory;
}

/**
 * メモリクリーンアップを実行
 */
function performMemoryCleanup() {
  try {
    console.log('🧹 メモリクリーンアップ実行中...');
    
    // 統計データの一部をクリア
    if (PERFORMANCE_MONITOR.memoryUsage.length > 100) {
      PERFORMANCE_MONITOR.memoryUsage = PERFORMANCE_MONITOR.memoryUsage.slice(-50);
    }
    
    // ガベージコレクション促進
    Utilities.sleep(100);
    
    console.log('✅ メモリクリーンアップ完了');
    
  } catch (error) {
    console.warn(`メモリクリーンアップエラー: ${error.toString()}`);
  }
}

/**
 * バッチ処理の最適化
 * @param {Array} items - 処理対象アイテム
 * @param {Function} processor - 処理関数
 * @param {number} batchSize - バッチサイズ
 * @return {Array} 処理結果
 */
function optimizedBatchProcess(items, processor, batchSize = GAS_LIMITS.BATCH_SIZE) {
  const results = [];
  const batches = splitIntoBatches(items, batchSize);
  
  console.log(`📦 バッチ処理開始: ${batches.length} バッチ, 各${batchSize}件`);
  
  batches.forEach((batch, index) => {
    const batchStartTime = Date.now();
    
    try {
      console.log(`バッチ ${index + 1}/${batches.length} 処理中...`);
      
      const batchResults = batch.map((item, itemIndex) => {
        try {
          // メモリ監視
          if (itemIndex % 10 === 0) {
            monitorMemoryUsage();
          }
          
          return processor(item);
          
        } catch (error) {
          console.warn(`アイテム処理エラー [${itemIndex}]: ${error.toString()}`);
          PERFORMANCE_MONITOR.errors.push(`バッチ${index + 1}-アイテム${itemIndex}: ${error.message}`);
          return null;
        }
      });
      
      results.push(...batchResults.filter(result => result !== null));
      
      const batchTime = Date.now() - batchStartTime;
      PERFORMANCE_MONITOR.executionTimes[`batch_${index + 1}`] = batchTime;
      
      // バッチ間の待機（レート制限対策）
      if (index < batches.length - 1) {
        const waitTime = Math.max(1000, batchTime / 10); // 処理時間の10%待機
        console.log(`次のバッチまで ${waitTime}ms 待機...`);
        Utilities.sleep(waitTime);
      }
      
    } catch (error) {
      console.error(`バッチ ${index + 1} 処理エラー: ${error.toString()}`);
      PERFORMANCE_MONITOR.errors.push(`バッチ${index + 1}: ${error.message}`);
    }
  });
  
  console.log(`✅ バッチ処理完了: ${results.length}/${items.length} 件成功`);
  return results;
}

/**
 * API呼び出し制限の管理
 * @param {string} apiType - API種別 (gemini, obsidian, rss)
 */
function trackApiCall(apiType) {
  if (PERFORMANCE_MONITOR.apiCallCounts[apiType] !== undefined) {
    PERFORMANCE_MONITOR.apiCallCounts[apiType]++;
  }
  
  // レート制限チェック
  const totalCalls = Object.values(PERFORMANCE_MONITOR.apiCallCounts).reduce((sum, count) => sum + count, 0);
  
  if (totalCalls > GAS_LIMITS.MAX_API_CALLS_PER_MINUTE) {
    console.warn('⚠️ API呼び出し制限に近づいています');
    Utilities.sleep(2000); // 2秒追加待機
  }
}

/**
 * 回復可能なエラーハンドリング
 * @param {Function} operation - 実行する操作
 * @param {number} maxRetries - 最大リトライ回数
 * @param {number} baseDelay - 基本待機時間
 * @return {any} 操作結果
 */
function resilientOperation(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return operation();
      
    } catch (error) {
      lastError = error;
      
      // 回復不可能なエラーの判定
      if (isUnrecoverableError(error)) {
        console.error(`回復不可能なエラー: ${error.toString()}`);
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // 指数バックオフ
        console.warn(`操作失敗 (試行 ${attempt}/${maxRetries}): ${error.toString()}`);
        console.log(`${delay}ms 待機後に再試行...`);
        Utilities.sleep(delay);
      }
    }
  }
  
  throw new Error(`操作が ${maxRetries} 回試行しても失敗: ${lastError.toString()}`);
}

/**
 * 回復不可能なエラーかどうかを判定
 * @param {Error} error - エラーオブジェクト
 * @return {boolean} 回復不可能フラグ
 */
function isUnrecoverableError(error) {
  const unrecoverablePatterns = [
    '実行時間制限',
    'APIキー',
    '設定',
    '認証',
    '権限',
    '400', // Bad Request
    '401', // Unauthorized
    '403', // Forbidden
    '404'  // Not Found
  ];
  
  return unrecoverablePatterns.some(pattern => 
    error.toString().toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * パフォーマンス統計をログ出力
 */
function logPerformanceSummary() {
  console.log('\n📊 === パフォーマンスサマリー ===');
  
  // API呼び出し統計
  console.log('🔗 API呼び出し回数:');
  Object.entries(PERFORMANCE_MONITOR.apiCallCounts).forEach(([api, count]) => {
    console.log(`  - ${api}: ${count} 回`);
  });
  
  // 実行時間統計
  console.log('\n⏱️ バッチ実行時間:');
  Object.entries(PERFORMANCE_MONITOR.executionTimes).forEach(([batch, time]) => {
    console.log(`  - ${batch}: ${Math.round(time / 1000)} 秒`);
  });
  
  // メモリ使用量
  if (PERFORMANCE_MONITOR.memoryUsage.length > 0) {
    const lastMemory = PERFORMANCE_MONITOR.memoryUsage[PERFORMANCE_MONITOR.memoryUsage.length - 1];
    console.log(`\n💾 推定メモリ使用量: ${Math.round(lastMemory.usage / 1024 / 1024)} MB`);
  }
  
  // エラー統計
  if (PERFORMANCE_MONITOR.errors.length > 0) {
    console.log(`\n❌ エラー数: ${PERFORMANCE_MONITOR.errors.length}`);
    PERFORMANCE_MONITOR.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }
  
  // 警告統計
  if (PERFORMANCE_MONITOR.warnings.length > 0) {
    console.log(`\n⚠️ 警告数: ${PERFORMANCE_MONITOR.warnings.length}`);
  }
  
  console.log('===============================');
}

/**
 * システムリソース使用量をチェック
 */
function checkSystemResources() {
  console.log('=== システムリソースチェック ===');
  
  try {
    // 実行時間チェック
    const maxTime = GAS_LIMITS.MAX_EXECUTION_TIME / 1000;
    console.log(`⏱️ 最大実行時間: ${Math.round(maxTime)} 秒`);
    
    // メモリ推定チェック
    const estimatedMemory = estimateMemoryUsage();
    const memoryMB = Math.round(estimatedMemory / 1024 / 1024);
    console.log(`💾 推定メモリ使用量: ${memoryMB} MB`);
    
    // API制限チェック
    const totalApiCalls = Object.values(PERFORMANCE_MONITOR.apiCallCounts).reduce((sum, count) => sum + count, 0);
    console.log(`🔗 API呼び出し総数: ${totalApiCalls} 回`);
    
    // トリガー制限チェック
    const triggers = ScriptApp.getProjectTriggers();
    console.log(`🔄 登録トリガー数: ${triggers.length} 個`);
    
    console.log('✅ システムリソースチェック完了');
    
  } catch (error) {
    console.error(`システムリソースチェックエラー: ${error.toString()}`);
  }
  
  console.log('===============================');
}

/**
 * パフォーマンス最適化のテスト
 */
function testPerformanceOptimization() {
  console.log('=== パフォーマンス最適化テスト開始 ===');
  
  try {
    // 1. バッチ処理テスト
    console.log('\n1. バッチ処理テスト:');
    const testItems = Array.from({length: 20}, (_, i) => `item${i + 1}`);
    const testProcessor = (item) => {
      Utilities.sleep(100); // 処理時間をシミュレート
      return `processed_${item}`;
    };
    
    const results = optimizedBatchProcess(testItems, testProcessor, 5);
    console.log(`結果: ${results.length} 件処理完了`);
    
    // 2. 回復可能エラーハンドリングテスト
    console.log('\n2. エラーハンドリングテスト:');
    let attemptCount = 0;
    const testOperation = () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error(`テストエラー (試行 ${attemptCount})`);
      }
      return 'success';
    };
    
    const result = resilientOperation(testOperation, 3, 500);
    console.log(`結果: ${result}`);
    
    // 3. システムリソースチェック
    console.log('\n3. システムリソースチェック:');
    checkSystemResources();
    
    // 4. パフォーマンス統計
    console.log('\n4. パフォーマンス統計:');
    logPerformanceSummary();
    
    console.log('\n✅ パフォーマンス最適化テスト完了');
    
  } catch (error) {
    console.error(`パフォーマンス最適化テストエラー: ${error.toString()}`);
  }
  
  console.log('=== パフォーマンス最適化テスト終了 ===');
}