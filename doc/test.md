# RSS Feeder ユニットテスト項目

## テスト概要

RSS記事正規化機能、エラーハンドリング、Obsidian保存機能のユニットテスト項目を定義。LLMのフィルタリング機能とローカルでのObsidian保存機能の動作確認を重視。

## 1. RSS記事正規化機能テスト

### 1.1 記事データ構造正規化テスト
**テスト対象**: `feedFetcher.js` - `normalizeItem()`

#### テストケース
```javascript
// TC-1.1.1: 完全な記事データの正規化
input: {
  title: "Sample Article",
  link: "https://example.com/article",
  description: "<p>Article description</p>",
  pubDate: "2025-06-28T10:00:00Z",
  creator: "Author Name",
  categories: ["tech", "ai"]
}
expected: {
  title: "Sample Article",
  link: "https://example.com/article", 
  description: "Article description", // HTMLタグ除去
  pubDate: Date object,
  creator: "Author Name",
  categories: ["tech", "ai"],
  guid: "https://example.com/article"
}
```

#### TC-1.1.2: 不完全な記事データの補完
```javascript
input: {
  // title missing
  link: "https://example.com/article"
  // other fields missing
}
expected: {
  title: "Untitled",
  link: "https://example.com/article",
  description: "",
  content: "",
  pubDate: Date object (current time),
  creator: "",
  categories: [],
  guid: "https://example.com/article"
}
```

#### TC-1.1.3: 空データの処理
```javascript
input: null / undefined / {}
expected: デフォルト値で補完された記事オブジェクト
```

### 1.2 HTMLタグ除去テスト
**テスト対象**: `utils.js` - `stripHtml()`

#### テストケース
```javascript
// TC-1.2.1: 基本的なHTMLタグ除去
input: "<p>Text with <strong>bold</strong> and <em>italic</em></p>"
expected: "Text with bold and italic"

// TC-1.2.2: ネストしたHTMLタグ
input: "<div><p>Nested <span>tags</span></p></div>"
expected: "Nested tags"

// TC-1.2.3: 属性付きタグ
input: '<a href="https://example.com" class="link">Link text</a>'
expected: "Link text"

// TC-1.2.4: HTMLエンティティ
input: "&lt;script&gt;alert('test')&lt;/script&gt;"
expected: "&lt;script&gt;alert('test')&lt;/script&gt;" // エンティティはそのまま
```

### 1.3 重複記事除去テスト
**テスト対象**: `feedFetcher.js` - `removeDuplicates()`

#### テストケース
```javascript
// TC-1.3.1: タイトル+リンクベースの重複除去
input: [
  { title: "Article 1", link: "https://example.com/1" },
  { title: "Article 1", link: "https://example.com/1" }, // 重複
  { title: "Article 2", link: "https://example.com/2" }
]
expected: [
  { title: "Article 1", link: "https://example.com/1" },
  { title: "Article 2", link: "https://example.com/2" }
]

// TC-1.3.2: 同タイトル異なるリンク（重複なし）
input: [
  { title: "Article 1", link: "https://site1.com/article" },
  { title: "Article 1", link: "https://site2.com/article" }
]
expected: 両方とも残る（重複ではない）
```

### 1.4 フィード情報付加テスト
**テスト対象**: `feedFetcher.js` - `getAllArticles()`

#### テストケース
```javascript
// TC-1.4.1: フィード情報の付加
input: フィード情報 { title: "TechCrunch", link: "https://techcrunch.com" }
expected: 各記事に feedTitle, feedLink が追加される
```

## 2. エラーハンドリングテスト

### 2.1 不正な記事データ処理テスト

#### テストケース
```javascript
// TC-2.1.1: null記事の処理
input: [null, undefined, validArticle]
expected: null/undefinedをスキップし、有効記事のみ処理

// TC-2.1.2: 不正なpubDateの処理
input: { title: "Test", pubDate: "invalid-date" }
expected: 現在時刻をpubDateとして設定

// TC-2.1.3: 不正なリンクの処理
input: { title: "Test", link: null }
expected: guidまたは空文字列で補完
```

### 2.2 ネットワークエラー処理テスト
**テスト対象**: `feedFetcher.js` - `fetchFeed()`

#### テストケース
```javascript
// TC-2.2.1: HTTPエラー（404, 500等）
mock: axios.get throws error with status 404
expected: エラーログ出力、nullを返す

// TC-2.2.2: タイムアウトエラー
mock: axios.get throws timeout error
expected: エラーログ出力、リトライ処理

// TC-2.2.3: ネットワーク接続エラー
mock: axios.get throws connection error
expected: エラーログ出力、処理続行
```

### 2.3 リトライ機能テスト
**テスト対象**: `utils.js` - `retry()`

#### テストケース
```javascript
// TC-2.3.1: 正常なリトライ（最終的に成功）
scenario: 1回目失敗、2回目成功
expected: 2回目で正常な結果を返す

// TC-2.3.2: 最大リトライ回数超過
scenario: 設定回数まで全て失敗
expected: 最終的にエラーを投げる

// TC-2.3.3: 指数バックオフの動作
scenario: リトライ間隔が指数的に増加することを確認
expected: 1000ms, 2000ms, 4000ms...
```

## 3. Obsidian保存機能テスト (ローカル)

### 3.1 マークダウンファイル生成テスト
**テスト対象**: `obsidianAPI.js` - `generateMarkdownContent()`

#### テストケース
```javascript
// TC-3.1.1: 基本的なマークダウン生成
input: {
  tag: "tech/ai",
  articles: [{ title: "AI Article", link: "https://example.com", description: "AI description" }],
  summary: "AI関連記事の要約",
  count: 1
}
expected: 
"# TECH/AI - 2025年06月28日

## 概要
AI関連記事の要約

**記事数**: 1件

## 記事一覧
### 1. AI Article
**リンク**: [https://example.com](https://example.com)
**概要**: AI description
---"

// TC-3.1.2: 複数記事のマークダウン生成
input: 複数記事データ
expected: 記事数に応じた適切なマークダウン

// TC-3.1.3: 日本語文字化け対応
input: 日本語タイトル・説明を含む記事
expected: 正しく日本語が表示される
```

### 3.2 YAML frontmatter生成テスト
**テスト対象**: `utils.js` - `generateYamlFrontmatter()`

#### テストケース
```javascript
// TC-3.2.1: 基本的なYAML生成
input: {
  date: "2025-06-28",
  tag: "tech/ai", 
  count: 5,
  tags: ["tech", "ai"]
}
expected: 
"---
date: 2025-06-28
tag: tech/ai
count: 5
tags:
  - tech
  - ai
---"

// TC-3.2.2: 特殊文字を含むYAML生成
input: 特殊文字、日本語を含むメタデータ
expected: 適切にエスケープされたYAML
```

### 3.3 ディレクトリ構造作成テスト
**テスト対象**: `obsidianAPI.js` - `createDateDirectory()`, `createTagFile()`

#### テストケース
```javascript
// TC-3.3.1: 日付ディレクトリ作成
input: date = new Date("2025-06-28")
expected: "./output/RSS/2025-06-28/" ディレクトリが作成される

// TC-3.3.2: 階層タグディレクトリ作成
input: tag = "tech/ai"
expected: "./output/RSS/2025-06-28/tech/" ディレクトリが作成される

// TC-3.3.3: フラットタグファイル作成
input: tag = "business"
expected: "./output/RSS/2025-06-28/business.md" ファイルが作成される
```

### 3.4 ファイル名生成テスト
**テスト対象**: `utils.js` - `sanitizeFilename()`

#### テストケース
```javascript
// TC-3.4.1: 禁止文字の除去
input: "tech/ai<>:\"|?*"
expected: "tech-ai"

// TC-3.4.2: スペースの処理
input: "machine learning"
expected: "machine-learning"

// TC-3.4.3: 日本語ファイル名
input: "人工知能"
expected: "人工知能" // 日本語はそのまま（システム対応していれば）
```

### 3.5 インデックスファイル作成テスト
**テスト対象**: `obsidianAPI.js` - `createIndexFile()`

#### テストケース
```javascript
// TC-3.5.1: 日別インデックス生成
input: processedData with multiple categories
expected: 
- 総記事数の正確な計算
- カテゴリ別記事数の表示
- 各カテゴリファイルへの正しいリンク

// TC-3.5.2: 空データでのインデックス生成
input: 空のprocessedData
expected: エラーなく空のインデックスファイル生成
```

## 4. 設定・環境変数テスト

### 4.1 feeds.json読み込みテスト
**テスト対象**: `config.js` - `getRssFeeds()`

#### テストケース
```javascript
// TC-4.1.1: 正常なfeeds.json読み込み
setup: enabled: true のフィードが2つ
expected: 有効なフィードのURLのみを配列で返す

// TC-4.1.2: feeds.jsonが存在しない
setup: feeds.jsonファイルを削除
expected: 空配列を返す、警告ログ出力

// TC-4.1.3: 不正なJSON形式
setup: 壊れたJSONファイル
expected: エラーログ出力、空配列を返す
```

### 4.2 環境変数優先度テスト

#### テストケース
```javascript
// TC-4.2.1: RSS_FEEDS環境変数の優先
setup: RSS_FEEDS環境変数設定 + feeds.json存在
expected: 環境変数の値を使用

// TC-4.2.2: feeds.jsonフォールバック
setup: RSS_FEEDS環境変数なし + feeds.json存在
expected: feeds.jsonの値を使用
```

### 4.3 デバッグモード動作テスト

#### テストケース
```javascript
// TC-4.3.1: DEBUG=true時のログ出力
setup: DEBUG=true
expected: 詳細ログが出力される

// TC-4.3.2: DEBUG=false時のログ抑制
setup: DEBUG=false
expected: 基本ログのみ出力
```

## テスト実装ガイドライン

### テストフレームワーク
- **Jest**: メインテストフレームワーク
- **sinon**: モック・スタブ作成
- **tmp**: 一時ディレクトリ作成（ファイル出力テスト用）

### モックデータ準備
```javascript
const mockRssData = {
  title: "Test Feed",
  items: [
    {
      title: "Test Article 1",
      link: "https://example.com/1",
      description: "<p>Test description</p>",
      pubDate: "2025-06-28T10:00:00Z"
    }
  ]
};
```

### テスト環境セットアップ
```javascript
beforeEach(() => {
  // 一時ディレクトリ作成
  // 環境変数初期化
  // モック初期化
});

afterEach(() => {
  // 一時ファイル削除
  // モック復元
});
```

### 実行コマンド例
```bash
# 全テスト実行
npm test

# 特定のテストファイル実行
npm test -- test/feedFetcher.test.js

# カバレッジ付き実行
npm test -- --coverage
```