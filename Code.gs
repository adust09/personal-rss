/**
 * Code.gs - RSS Feeder メイン統合処理スクリプト
 * 全モジュールを統合し、日次RSS処理を実行する
 */

/**
 * 実行統計管理
 */
const EXECUTION_STATS = {
  startTime: null,
  endTime: null,
  totalArticles: 0,
  processedArticles: 0,
  createdFiles: 0,
  errors: []
};

/**
 * メイン処理関数
 * 毎日午前8時にトリガーで実行される
 */
function main() {
  const stopTimer = startTimer('RSS Feeder メイン処理');
  EXECUTION_STATS.startTime = getJapanTime();
  
  console.log('=== RSS Feeder 日次処理開始 ===');
  console.log(`実行時刻: ${EXECUTION_STATS.startTime.toLocaleString('ja-JP')}`);
  
  try {
    // 1. 設定検証
    console.log('\n📋 Step 1: 設定検証');
    if (!validateSystemConfiguration()) {
      throw new Error('システム設定に問題があります');
    }
    
    // 2. RSSフィード取得
    console.log('\n📰 Step 2: RSSフィード取得');
    const allArticles = fetchAllFeeds();
    EXECUTION_STATS.totalArticles = allArticles.length;
    
    if (allArticles.length === 0) {
      console.warn('取得された記事が0件です。処理を終了します。');
      logExecutionSummary(true);
      return;
    }
    
    // 3. 今日の記事のフィルタリング
    console.log('\n📅 Step 3: 今日の記事フィルタリング');
    const todayArticles = filterTodayArticles(allArticles);
    const uniqueArticles = removeDuplicateArticles(todayArticles);
    
    console.log(`全記事: ${allArticles.length} → 今日の記事: ${todayArticles.length} → 重複除去後: ${uniqueArticles.length}`);
    
    if (uniqueArticles.length === 0) {
      console.warn('今日の新しい記事が0件です。処理を終了します。');
      logExecutionSummary(true);
      return;
    }
    
    // 4. AI処理（タグ付け）
    console.log('\n🤖 Step 4: AI タグ付け処理');
    const taggedArticles = processWithGemini(uniqueArticles);
    EXECUTION_STATS.processedArticles = taggedArticles.length;
    
    if (taggedArticles.length === 0) {
      throw new Error('タグ付け処理で有効な記事が0件になりました');
    }
    
    // 5. タグ別グルーピング
    console.log('\n🏷️ Step 5: タグ別グルーピング');
    const groupedByTag = groupArticlesByTag(taggedArticles);
    const tagCount = Object.keys(groupedByTag).length;
    
    console.log(`生成されたタグ: ${tagCount} 個`);
    Object.entries(groupedByTag).forEach(([tag, articles]) => {
      console.log(`  - ${tag}: ${articles.length} 件`);
    });
    
    // 6. Obsidianファイル作成
    console.log('\n📝 Step 6: Obsidianファイル作成');
    const results = createAllObsidianFiles(groupedByTag);
    EXECUTION_STATS.createdFiles = results.success;
    
    if (results.failure > 0) {
      console.warn(`一部のファイル作成に失敗しました: ${results.failure} 件`);
      EXECUTION_STATS.errors.push(...results.errors);
    }
    
    // 7. 実行結果サマリー
    console.log('\n📊 Step 7: 実行結果サマリー');
    logExecutionSummary(results.failure === 0);
    
    // 8. クリーンアップ（任意）
    console.log('\n🧹 Step 8: クリーンアップ');
    performCleanup();
    
  } catch (error) {
    const errorMsg = formatError('メイン処理', error);
    console.error(errorMsg);
    EXECUTION_STATS.errors.push(errorMsg);
    
    // エラー発生時もサマリーログを出力
    logExecutionSummary(false);
    
    // 重要: エラーを再スローしてGASログに残す
    throw error;
    
  } finally {
    EXECUTION_STATS.endTime = getJapanTime();
    const duration = stopTimer();
    console.log(`\n⏱️ 総実行時間: ${duration}ms`);
    console.log('=== RSS Feeder 日次処理終了 ===');
  }
}

/**
 * システム設定の検証
 * @return {boolean} 設定が有効かどうか
 */
function validateSystemConfiguration() {
  try {
    console.log('システム設定を検証中...');
    
    // Config.gs の設定検証
    const configValidation = validateConfig();
    
    if (!configValidation.isValid) {
      console.error('設定エラー:');
      configValidation.errors.forEach(error => console.error(`  - ${error}`));
      return false;
    }
    
    if (configValidation.warnings.length > 0) {
      console.warn('設定警告:');
      configValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
    
    // API接続テスト（軽量版）
    console.log('API接続確認中...');
    
    // Gemini API簡易テスト
    const geminiKey = getGeminiApiKey();
    if (!geminiKey) {
      console.error('Gemini APIキーが設定されていません');
      return false;
    }
    
    // Obsidian API簡易テスト
    const obsidianKey = getObsidianApiKey();
    if (!obsidianKey) {
      console.error('Obsidian APIキーが設定されていません');
      return false;
    }
    
    console.log('✅ システム設定検証完了');
    return true;
    
  } catch (error) {
    console.error(`設定検証エラー: ${error.toString()}`);
    return false;
  }
}

/**
 * 実行統計をログ出力する
 * @param {boolean} success - 実行成功フラグ
 */
function logExecutionSummary(success) {
  const duration = EXECUTION_STATS.endTime ? 
    EXECUTION_STATS.endTime.getTime() - EXECUTION_STATS.startTime.getTime() : 0;
  
  console.log('\n📊 === 実行サマリー ===');
  console.log(`状態: ${success ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`開始時刻: ${EXECUTION_STATS.startTime.toLocaleString('ja-JP')}`);
  
  if (EXECUTION_STATS.endTime) {
    console.log(`終了時刻: ${EXECUTION_STATS.endTime.toLocaleString('ja-JP')}`);
    console.log(`実行時間: ${Math.round(duration / 1000)} 秒`);
  }
  
  console.log(`総記事数: ${EXECUTION_STATS.totalArticles}`);
  console.log(`処理記事数: ${EXECUTION_STATS.processedArticles}`);
  console.log(`作成ファイル数: ${EXECUTION_STATS.createdFiles}`);
  
  if (EXECUTION_STATS.errors.length > 0) {
    console.log(`エラー数: ${EXECUTION_STATS.errors.length}`);
    console.log('エラー詳細:');
    EXECUTION_STATS.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }
  
  console.log('===================');
}

/**
 * クリーンアップ処理
 */
function performCleanup() {
  try {
    console.log('クリーンアップ処理開始...');
    
    // 統計データリセット
    EXECUTION_STATS.totalArticles = 0;
    EXECUTION_STATS.processedArticles = 0;
    EXECUTION_STATS.createdFiles = 0;
    EXECUTION_STATS.errors = [];
    
    // ガベージコレクション促進
    Utilities.sleep(100);
    
    console.log('✅ クリーンアップ完了');
    
  } catch (error) {
    console.warn(`クリーンアップエラー: ${error.toString()}`);
  }
}

/**
 * 手動実行用のテスト関数
 */
function testFullSystem() {
  console.log('=== RSS Feeder 全システムテスト開始 ===');
  
  try {
    // 各モジュールの個別テスト
    console.log('\n1. Config モジュールテスト');
    displayConfig();
    
    console.log('\n2. Utils モジュールテスト');
    testUtils();
    
    console.log('\n3. FeedFetcher モジュールテスト');
    testFeedFetcher();
    
    console.log('\n4. LLMProcessor モジュールテスト');
    testLLMProcessor();
    
    console.log('\n5. ObsidianAPI モジュールテスト');
    testObsidianAPI();
    
    console.log('\n6. メイン処理テスト（実際のデータ処理は行わない）');
    console.log('メイン処理をテストするには main() 関数を直接実行してください');
    
    console.log('\n✅ 全システムテスト完了');
    
  } catch (error) {
    console.error(`システムテストエラー: ${error.toString()}`);
  }
  
  console.log('=== RSS Feeder 全システムテスト終了 ===');
}

/**
 * デバッグ用：少数記事での動作確認
 */
function testWithLimitedArticles() {
  console.log('=== 制限記事数テスト開始 ===');
  
  try {
    // 設定検証
    if (!validateSystemConfiguration()) {
      throw new Error('設定に問題があります');
    }
    
    // 少数のフィードのみテスト
    console.log('少数のRSSフィードを取得中...');
    const feeds = getRssFeeds();
    const limitedFeeds = feeds.slice(0, 2); // 最初の2つのフィードのみ
    
    console.log(`テスト対象フィード: ${limitedFeeds.length} 個`);
    limitedFeeds.forEach((feed, index) => {
      console.log(`  ${index + 1}. ${feed}`);
    });
    
    // 制限的に処理実行
    const articles = [];
    for (const feedUrl of limitedFeeds) {
      try {
        const feedArticles = fetchSingleFeed(feedUrl);
        articles.push(...feedArticles.slice(0, 3)); // 各フィードから3記事まで
      } catch (error) {
        console.warn(`フィード取得失敗: ${feedUrl}`);
      }
    }
    
    console.log(`取得記事数: ${articles.length}`);
    
    if (articles.length > 0) {
      // 制限記事でタグ付けテスト
      const limitedArticles = articles.slice(0, 5); // 最大5記事
      console.log(`タグ付けテスト: ${limitedArticles.length} 記事`);
      
      const taggedArticles = processWithGemini(limitedArticles);
      const groupedByTag = groupArticlesByTag(taggedArticles);
      
      console.log('タグ付け結果:');
      Object.entries(groupedByTag).forEach(([tag, tagArticles]) => {
        console.log(`  - ${tag}: ${tagArticles.length} 記事`);
      });
      
      console.log('✅ 制限記事数テスト完了');
    } else {
      console.warn('テスト用記事が取得できませんでした');
    }
    
  } catch (error) {
    console.error(`制限記事数テストエラー: ${error.toString()}`);
  }
  
  console.log('=== 制限記事数テスト終了 ===');
}

/**
 * システム状態を表示する
 */
function showSystemStatus() {
  console.log('=== RSS Feeder システム状態 ===');
  
  try {
    // 基本情報
    console.log('📅 現在時刻:', getJapanTime().toLocaleString('ja-JP'));
    console.log('📅 処理日付:', getCurrentDateString());
    
    // 設定情報
    console.log('\n🔧 設定情報:');
    displayConfig();
    
    // フィード情報
    const feeds = getRssFeeds();
    console.log(`\n📰 登録フィード数: ${feeds.length}`);
    
    // 出力ディレクトリ情報
    const outputDir = getOutputDirectory();
    const todayPath = `${outputDir}/${getCurrentDateString()}/`;
    console.log(`\n📁 今日の出力パス: ${todayPath}`);
    
    // システム制限情報
    console.log('\n⚠️ システム制限:');
    console.log('- GAS実行時間制限: 6分');
    console.log('- Geminiレート制限: 2秒間隔');
    console.log('- Obsidianファイルサイズ制限: 1MB');
    
    console.log('\n✅ システム状態表示完了');
    
  } catch (error) {
    console.error(`システム状態取得エラー: ${error.toString()}`);
  }
  
  console.log('============================');
}

/**
 * 緊急停止用関数
 */
function emergencyStop() {
  console.log('🚨 緊急停止が実行されました');
  console.log('現在の処理を中断します');
  
  // 統計情報を出力
  if (EXECUTION_STATS.startTime) {
    logExecutionSummary(false);
  }
  
  throw new Error('緊急停止: ユーザーによる手動中断');
}

/**
 * 毎日午前8時実行のトリガーを作成する
 */
function createDailyTrigger() {
  console.log('=== 日次トリガー設定開始 ===');
  
  try {
    // 既存のトリガーを確認・削除
    deleteDailyTrigger();
    
    // 新しいトリガーを作成
    const trigger = ScriptApp.newTrigger('main')
      .timeBased()
      .everyDays(1)
      .atHour(8) // 午前8時
      .create();
    
    console.log(`✅ 日次トリガー作成完了: ID ${trigger.getUniqueId()}`);
    console.log('📅 実行スケジュール: 毎日午前8時');
    console.log('🔄 実行関数: main()');
    
    // トリガー情報をログに保存
    console.log('\n現在のトリガー一覧:');
    listAllTriggers();
    
    return trigger;
    
  } catch (error) {
    console.error(`トリガー作成エラー: ${error.toString()}`);
    throw error;
  }
  
  console.log('=== 日次トリガー設定完了 ===');
}

/**
 * 日次トリガーを削除する
 */
function deleteDailyTrigger() {
  console.log('既存のトリガーを確認中...');
  
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    
    triggers.forEach(trigger => {
      // main関数の時間ベーストリガーを削除
      if (trigger.getHandlerFunction() === 'main' && 
          trigger.getEventType() === ScriptApp.EventType.CLOCK) {
        console.log(`削除: トリガーID ${trigger.getUniqueId()}`);
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    });
    
    if (deletedCount > 0) {
      console.log(`✅ 既存トリガー削除完了: ${deletedCount} 個`);
    } else {
      console.log('削除対象のトリガーはありませんでした');
    }
    
  } catch (error) {
    console.warn(`トリガー削除エラー: ${error.toString()}`);
  }
}

/**
 * 全てのトリガーを一覧表示する
 */
function listAllTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    
    if (triggers.length === 0) {
      console.log('設定されているトリガーはありません');
      return;
    }
    
    console.log(`登録トリガー数: ${triggers.length}`);
    triggers.forEach((trigger, index) => {
      const handlerFunction = trigger.getHandlerFunction();
      const eventType = trigger.getEventType();
      const triggerSource = trigger.getTriggerSource();
      
      console.log(`${index + 1}. ${handlerFunction}()`);
      console.log(`   - ID: ${trigger.getUniqueId()}`);
      console.log(`   - イベント: ${eventType}`);
      console.log(`   - ソース: ${triggerSource}`);
      
      // 時間ベーストリガーの詳細
      if (eventType === ScriptApp.EventType.CLOCK) {
        console.log(`   - 実行間隔: 毎日`);
      }
    });
    
  } catch (error) {
    console.error(`トリガー一覧取得エラー: ${error.toString()}`);
  }
}

/**
 * 全てのトリガーを削除する（クリーンアップ用）
 */
function deleteAllTriggers() {
  console.log('=== 全トリガー削除開始 ===');
  console.warn('⚠️ 警告: 全てのトリガーが削除されます');
  
  try {
    const triggers = ScriptApp.getProjectTriggers();
    
    if (triggers.length === 0) {
      console.log('削除対象のトリガーはありません');
      return;
    }
    
    console.log(`削除対象: ${triggers.length} 個のトリガー`);
    
    triggers.forEach((trigger, index) => {
      const handlerFunction = trigger.getHandlerFunction();
      const triggerId = trigger.getUniqueId();
      
      console.log(`${index + 1}. ${handlerFunction}() (ID: ${triggerId}) を削除中...`);
      ScriptApp.deleteTrigger(trigger);
    });
    
    console.log('✅ 全トリガー削除完了');
    
  } catch (error) {
    console.error(`全トリガー削除エラー: ${error.toString()}`);
    throw error;
  }
  
  console.log('=== 全トリガー削除完了 ===');
}

/**
 * トリガー設定の管理とテスト
 */
function manageTriggers() {
  console.log('=== トリガー管理 ===');
  
  try {
    console.log('\n現在のトリガー状況:');
    listAllTriggers();
    
    console.log('\n利用可能な管理コマンド:');
    console.log('- createDailyTrigger(): 日次トリガーを作成');
    console.log('- deleteDailyTrigger(): 日次トリガーを削除');
    console.log('- deleteAllTriggers(): 全トリガーを削除');
    console.log('- listAllTriggers(): トリガー一覧表示');
    
  } catch (error) {
    console.error(`トリガー管理エラー: ${error.toString()}`);
  }
  
  console.log('==================');
}

/**
 * 手動でトリガーをテストする（実際の処理は行わない）
 */
function testTriggerSetup() {
  console.log('=== トリガー設定テスト開始 ===');
  
  try {
    // 1. 現在のトリガー状況確認
    console.log('\n1. 現在のトリガー確認:');
    listAllTriggers();
    
    // 2. テスト用トリガー作成
    console.log('\n2. テスト用トリガー作成:');
    const testTrigger = ScriptApp.newTrigger('showSystemStatus')
      .timeBased()
      .after(60000) // 1分後に実行
      .create();
    
    console.log(`✅ テスト用トリガー作成: ID ${testTrigger.getUniqueId()}`);
    console.log('📅 1分後に showSystemStatus() が実行されます');
    
    // 3. 作成後のトリガー一覧
    console.log('\n3. 作成後のトリガー一覧:');
    listAllTriggers();
    
    console.log('\n✅ トリガー設定テスト完了');
    console.log('💡 1分後にシステム状態が表示されることを確認してください');
    
  } catch (error) {
    console.error(`トリガー設定テストエラー: ${error.toString()}`);
  }
  
  console.log('=== トリガー設定テスト終了 ===');
}