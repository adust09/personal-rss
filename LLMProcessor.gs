/**
 * LLMProcessor.gs - RSS Feeder Gemini API 処理
 * 記事のタグ付けと要約生成を行う
 */

/**
 * Gemini API エンドポイント設定
 */
const GEMINI_CONFIG = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',
  MODEL_NAME: 'gemini-1.5-flash',
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1秒
  RATE_LIMIT_DELAY: 2000 // 2秒（レート制限対策）
};

/**
 * タグ付けプロンプトテンプレート
 */
const TAGGING_PROMPT_TEMPLATE = `以下の記事タイトルに適切なタグを付けてください。
タグは階層構造で、以下のような形式で出力してください：

利用可能なタグカテゴリ：
- tech/ai (AI・機械学習)
- tech/web (Web技術・開発)
- tech/mobile (モバイル開発)
- tech/cloud (クラウド技術)
- tech/security (セキュリティ技術)
- cryptography (暗号学・ブロックチェーン)
- business/startup (スタートアップ・起業)
- business/finance (金融・投資)
- science (科学・研究)
- programming (プログラミング言語・ツール)
- data (データ分析・BI)
- design (デザイン・UI/UX)
- marketing (マーケティング・広告)

複数のタグがある場合はカンマ区切りで出力してください（最大3個まで）。
英語のタイトルの場合も日本語で理解し、適切なタグを付けてください。

記事タイトル: "{title}"

出力形式: タグのみを出力（説明不要）
例: tech/ai, programming`;

/**
 * 要約プロンプトテンプレート
 */
const SUMMARY_PROMPT_TEMPLATE = `以下のタグ「{tag}」に関する記事一覧を要約してください。

記事数: {count}件
英語の記事タイトルも含まれる場合がありますが、すべて日本語で要約してください。

記事一覧:
{articleList}

以下の形式で要約を作成してください：
- 主要なトピックや傾向を説明
- 注目すべき記事を2-3個紹介
- 技術的な内容は分かりやすく解説
- 簡潔で読みやすい日本語で記述
- 200-400文字程度でまとめる

要約:`;

/**
 * 全記事にタグを付与する
 * @param {Array<RssArticle>} articles - 記事配列
 * @return {Array<Object>} タグ付き記事配列
 */
function processWithGemini(articles) {
  console.log(`Gemini API処理開始: ${articles.length} 件の記事`);
  
  if (articles.length === 0) {
    console.warn('処理する記事がありません');
    return [];
  }
  
  // API キーの確認
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini APIキーが設定されていません');
  }
  
  const taggedArticles = [];
  let successCount = 0;
  let failureCount = 0;
  
  // バッチ処理でレート制限に対応
  const batches = splitIntoBatches(articles, 5); // 5記事ずつ処理
  
  batches.forEach((batch, batchIndex) => {
    console.log(`バッチ ${batchIndex + 1}/${batches.length} 処理中`);
    
    batch.forEach((article, index) => {
      try {
        const tags = generateTags(article.title, apiKey);
        
        if (tags && tags.length > 0) {
          taggedArticles.push({
            article: article,
            tags: tags
          });
          successCount++;
          console.log(`  ${index + 1}. "${truncateText(article.title, 50)}" → [${tags.join(', ')}]`);
        } else {
          console.warn(`  ${index + 1}. タグ生成失敗: "${truncateText(article.title, 50)}"`);
          // タグなしでも記事は保持
          taggedArticles.push({
            article: article,
            tags: ['other']
          });
          failureCount++;
        }
        
        // レート制限対策
        if (index < batch.length - 1) {
          Utilities.sleep(GEMINI_CONFIG.RATE_LIMIT_DELAY);
        }
        
      } catch (error) {
        console.error(`  ${index + 1}. タグ付けエラー: "${truncateText(article.title, 50)}" - ${error.toString()}`);
        // エラー時もタグなしで保持
        taggedArticles.push({
          article: article,
          tags: ['other']
        });
        failureCount++;
      }
    });
    
    // バッチ間の待機
    if (batchIndex < batches.length - 1) {
      console.log('次のバッチまで待機中...');
      Utilities.sleep(3000);
    }
  });
  
  console.log(`タグ付け完了: 成功 ${successCount} 件, 失敗 ${failureCount} 件`);
  return taggedArticles;
}

/**
 * 記事タイトルからタグを生成する
 * @param {string} title - 記事タイトル
 * @param {string} apiKey - Gemini APIキー
 * @return {Array<string>} タグ配列
 */
function generateTags(title, apiKey) {
  const prompt = TAGGING_PROMPT_TEMPLATE.replace('{title}', title);
  
  try {
    const response = callGeminiAPI(prompt, apiKey);
    
    if (response && response.trim()) {
      // タグを解析
      const tags = response.trim()
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag && tag !== '')
        .slice(0, 3); // 最大3個まで
      
      // 有効なタグのみを返す
      return validateTags(tags);
    }
    
    return [];
    
  } catch (error) {
    console.error(`タグ生成API呼び出しエラー: ${error.toString()}`);
    return [];
  }
}

/**
 * タグ別記事群の要約を生成する
 * @param {string} tag - タグ名
 * @param {Array<RssArticle>} articles - 記事配列
 * @return {string} 要約テキスト
 */
function generateSummary(tag, articles) {
  console.log(`要約生成開始: ${tag} (${articles.length} 件)`);
  
  if (articles.length === 0) {
    return '';
  }
  
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.error('Gemini APIキーが設定されていません');
    return '';
  }
  
  try {
    // 記事リストを作成
    const articleList = articles.map((article, index) => {
      return `${index + 1}. ${article.title} (${article.feedTitle})`;
    }).join('\n');
    
    // プロンプト生成
    const prompt = SUMMARY_PROMPT_TEMPLATE
      .replace('{tag}', convertTagToJapanese(tag))
      .replace('{count}', articles.length.toString())
      .replace('{articleList}', articleList);
    
    const summary = callGeminiAPI(prompt, apiKey);
    
    if (summary && summary.trim()) {
      console.log(`要約生成完了: ${tag}`);
      return summary.trim();
    } else {
      console.warn(`要約生成失敗: ${tag}`);
      return generateFallbackSummary(tag, articles);
    }
    
  } catch (error) {
    console.error(`要約生成エラー [${tag}]: ${error.toString()}`);
    return generateFallbackSummary(tag, articles);
  }
}

/**
 * Gemini APIを呼び出す
 * @param {string} prompt - プロンプト
 * @param {string} apiKey - APIキー
 * @return {string} レスポンステキスト
 */
function callGeminiAPI(prompt, apiKey) {
  const url = `${GEMINI_CONFIG.BASE_URL}${GEMINI_CONFIG.MODEL_NAME}:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 1,
      topP: 1,
      maxOutputTokens: 1024,
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH", 
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ]
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  let lastError = null;
  
  // リトライ機能
  for (let attempt = 1; attempt <= GEMINI_CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`Gemini API呼び出し (試行 ${attempt}/${GEMINI_CONFIG.MAX_RETRIES})`);
      
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      if (responseCode === 200) {
        const data = JSON.parse(responseText);
        
        if (data.candidates && data.candidates.length > 0) {
          const candidate = data.candidates[0];
          if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
            return candidate.content.parts[0].text;
          }
        }
        
        throw new Error('有効なレスポンスが取得できませんでした');
        
      } else {
        throw new Error(`HTTP ${responseCode}: ${responseText}`);
      }
      
    } catch (error) {
      lastError = error;
      console.warn(`試行 ${attempt} 失敗: ${error.toString()}`);
      
      if (attempt < GEMINI_CONFIG.MAX_RETRIES) {
        console.log(`${GEMINI_CONFIG.RETRY_DELAY}ms 待機後に再試行...`);
        Utilities.sleep(GEMINI_CONFIG.RETRY_DELAY * attempt); // 段階的に待機時間を延長
      }
    }
  }
  
  throw new Error(`Gemini API呼び出し失敗 (全${GEMINI_CONFIG.MAX_RETRIES}回試行): ${lastError.toString()}`);
}

/**
 * タグの有効性を検証する
 * @param {Array<string>} tags - タグ配列
 * @return {Array<string>} 有効なタグ配列
 */
function validateTags(tags) {
  const validTags = [
    'tech/ai', 'tech/web', 'tech/mobile', 'tech/cloud', 'tech/security',
    'cryptography', 'business/startup', 'business/finance', 'science',
    'programming', 'data', 'design', 'marketing', 'other'
  ];
  
  return tags.filter(tag => {
    // 完全一致チェック
    if (validTags.includes(tag)) {
      return true;
    }
    
    // 階層タグの親カテゴリチェック
    const parentTag = tag.split('/')[0];
    if (['tech', 'business'].includes(parentTag)) {
      return true;
    }
    
    return false;
  });
}

/**
 * フォールバック要約を生成する（API失敗時）
 * @param {string} tag - タグ名
 * @param {Array<RssArticle>} articles - 記事配列
 * @return {string} フォールバック要約
 */
function generateFallbackSummary(tag, articles) {
  const tagName = convertTagToJapanese(tag);
  const articleCount = articles.length;
  
  let summary = `本日の${tagName}関連記事は${articleCount}件です。`;
  
  if (articles.length > 0) {
    summary += '主な記事として以下が挙げられます：\n\n';
    
    // 最大3記事を紹介
    const topArticles = articles.slice(0, 3);
    topArticles.forEach((article, index) => {
      summary += `${index + 1}. ${article.title}\n`;
    });
    
    if (articles.length > 3) {
      summary += `\nその他${articles.length - 3}件の関連記事があります。`;
    }
  }
  
  return summary;
}

/**
 * Gemini API の接続テスト
 */
function testGeminiConnection() {
  console.log('=== Gemini API 接続テスト開始 ===');
  
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.error('Gemini APIキーが設定されていません');
      return false;
    }
    
    // シンプルなテストプロンプト
    const testPrompt = 'こんにちは。このメッセージに「接続成功」と返答してください。';
    const response = callGeminiAPI(testPrompt, apiKey);
    
    if (response) {
      console.log('API接続成功');
      console.log('レスポンス:', response);
      return true;
    } else {
      console.error('レスポンスが空です');
      return false;
    }
    
  } catch (error) {
    console.error('API接続テストエラー:', error.toString());
    return false;
  }
  
  console.log('=== Gemini API 接続テスト完了 ===');
}

/**
 * タグ付けテスト
 */
function testTagging() {
  console.log('=== タグ付けテスト開始 ===');
  
  try {
    const testTitles = [
      'OpenAI Releases New GPT-5 Model with Enhanced Capabilities',
      'React 19の新機能とパフォーマンス改善について',
      'Bitcoin Price Surges to New All-Time High',
      'New Vulnerability Found in Popular Web Framework',
      'Machine Learning for Climate Change Prediction'
    ];
    
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      console.error('Gemini APIキーが設定されていません');
      return;
    }
    
    testTitles.forEach((title, index) => {
      console.log(`\n${index + 1}. "${title}"`);
      
      try {
        const tags = generateTags(title, apiKey);
        console.log(`   → タグ: [${tags.join(', ')}]`);
        
        // レート制限対策
        if (index < testTitles.length - 1) {
          Utilities.sleep(2000);
        }
        
      } catch (error) {
        console.error(`   → エラー: ${error.toString()}`);
      }
    });
    
  } catch (error) {
    console.error('タグ付けテストエラー:', error.toString());
  }
  
  console.log('\n=== タグ付けテスト完了 ===');
}

/**
 * LLM Processor の総合テスト
 */
function testLLMProcessor() {
  console.log('=== LLM Processor 総合テスト開始 ===');
  
  try {
    // 1. API接続テスト
    if (!testGeminiConnection()) {
      console.error('API接続テストに失敗しました');
      return;
    }
    
    // 2. タグ付けテスト
    testTagging();
    
    console.log('\n総合テスト完了');
    
  } catch (error) {
    console.error('総合テストエラー:', error.toString());
  }
  
  console.log('=== LLM Processor 総合テスト完了 ===');
}