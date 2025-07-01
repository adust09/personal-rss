# RSS Feeder - Technical Specifications

## Overview
A system that runs on a local server, fetches RSS feeds, performs tagging and summarization using the Gemini API, and creates markdown files directly in an Obsidian Vault via the Obsidian Local REST API

## System Architecture

### Project Structure
```
personal-rss/
├── src/
│   ├── main.js          # Main script
│   ├── config.js        # Configuration management
│   ├── feedFetcher.js   # RSS feed retrieval
│   ├── llmProcessor.js  # Gemini API processing
│   ├── obsidianAPI.js   # Obsidian Local REST API integration
│   └── utils.js         # Utility functions
├── config/
│   └── feeds.json       # Feed configuration
├── doc/
│   ├── doc.md           # Technical specifications (this file)
│   ├── scheduler-setup.md # Scheduler setup guide
│   └── test.md          # Test specifications
├── .env.example         # Environment variable template
├── .gitignore          # Git exclusion settings
└── package.json         # Node.js dependencies
```

### Technology Stack
- **Runtime Environment**: Local server (Windows/macOS/Linux)
- **Runtime**: Node.js 18+
- **Scheduler**: cron/systemd/Task Scheduler/PM2
- **Dependencies**:
  - rss-parser: RSS/XML parsing
  - axios: HTTP requests (RSS + Obsidian API)
  - date-fns: Date manipulation
  - js-yaml: YAML frontmatter generation
  - dotenv: Environment variable management

## 処理フロー詳細

### 1. RSSフィード取得 (feedFetcher.js)
- `.env` ファイルまたは環境変数 `RSS_FEEDS` からフィードURLリストを読み込み
- フォールバック: `config/feeds.json` ファイルからの読み込み
- `axios` でHTTPリクエスト実行
- `rss-parser` でXML解析
- エラーハンドリング: 失敗したフィードはスキップ
- 重複記事の除去（タイトル + リンクベース）
- 当日記事のフィルタリング

### 2. AI処理 (llmProcessor.js)
#### タグ付け処理
- Gemini API (`gemini-2.5-flash`) を使用
- 記事タイトルと説明を分析
- 階層タグシステム:
  - tech/ai, tech/web, tech/mobile, tech/devops
  - tech/security, tech/programming, tech/data
  - business, science, lifestyle, news, finance, education
- 1記事につき1-3個のタグを自動付与
- レート制限: リクエスト間隔調整可能

#### 要約生成
- タグごとにグループ化された記事を処理
- 各グループに対して日本語要約を生成
- 主要トピック、トレンド、注目記事を含む
- 英語記事も日本語で要約

### 3. Obsidian連携 (obsidianAPI.js)
- Obsidian Local REST API (https://127.0.0.1:27124/) に接続
- タグ階層に従ったVault内パス構成
- YAML frontmatter付きマークダウン生成
- 日付別インデックスファイル作成
- リアルタイムでObsidian Vaultにファイル作成
- 接続テストとエラーハンドリング

## 設定管理

### フィード設定 (config/feeds.json)
```json
{
  "name": "RSS Feeds Configuration",
  "description": "Configuration file for RSS feeds",
  "feeds": [
    {
      "name": "フィード名",
      "url": "https://example.com/feed.xml",
      "description": "フィードの説明",
      "category": "tech/ai",
      "enabled": true
    }
  ],
  "settings": {
    "defaultEnabled": false,
    "checkInterval": "daily"
  }
}
```

### 環境変数（.env ファイル推奨）

#### .env ファイル設定
```bash
# .env.example をコピーして .env ファイルを作成
cp .env.example .env
```

#### 環境変数一覧
```bash
# 必須
GEMINI_API_KEY          # Gemini API キー
OBSIDIAN_API_KEY        # Obsidian Local REST API キー

# オプション
RSS_FEEDS              # RSSフィードURLのJSON配列 (feeds.jsonより優先)
OBSIDIAN_API_URL       # Obsidian API URL (default: https://127.0.0.1:27124/)
DEBUG                  # デバッグモード (default: false)
TIMEZONE               # タイムゾーン (default: Asia/Tokyo)
MAX_RETRIES            # 最大リトライ回数 (default: 3)
GEMINI_MODEL           # Geminiモデル名 (default: gemini-2.5-flash)
GEMINI_REQUEST_DELAY   # API呼び出し間隔ms (default: 1000)
RETRY_DELAY            # リトライ間隔ms (default: 1000)
```

#### .env ファイル例
```bash
# コピーして .env として保存し、実際の値を設定
GEMINI_API_KEY=your-actual-gemini-api-key
OBSIDIAN_API_KEY=your-actual-obsidian-api-key
DEBUG=false
OBSIDIAN_API_URL=https://127.0.0.1:27124/
```

### 利用可能なGeminiモデル
```bash
# 推奨モデル
gemini-2.5-flash       # 最新の高速モデル (デフォルト)
gemini-2.5-pro         # 高精度モデル

# その他のモデル
gemini-2.0-flash       # 前世代高速モデル
gemini-1.5-flash       # 旧世代高速モデル
gemini-1.5-pro         # 旧世代高精度モデル
```

### Obsidian Local REST API設定
1. **プラグインインストール**:
   - Obsidian > Settings > Community plugins > Browse
   - "Local REST API" を検索・インストール・有効化

2. **API Key生成**:
   - プラグイン設定でAPI Keyを生成
   - 環境変数 `OBSIDIAN_API_KEY` に設定

3. **接続確認**:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" https://127.0.0.1:27124//vault/
   ```
****
## 出力形式

### Obsidian Vault構造
```
Obsidian Vault/
└── RSS/
    └── YYYY-MM-DD/
        ├── index.md              # 日別概要
        ├── tech/
        │   ├── ai.md            # AI関連記事
        │   ├── web.md           # Web開発関連
        │   └── security.md      # セキュリティ関連
        ├── business.md          # ビジネス関連
        └── science.md           # 科学関連
```

### マークダウンファイル構造
```markdown
---
date: YYYY-MM-DD
tag: tech/ai
count: 5
tags: [tech, ai]
generated: ISO8601_timestamp
---

# TAG_NAME - 日本語日付

## 概要
Gemini APIで生成された日本語要約

**記事数**: N件

## 記事一覧
### 1. 記事タイトル
**リンク**: [URL](URL)
**ソース**: フィード名
**著者**: 作成者
**公開日**: 日時
**概要**: 記事説明
**タグ**: タグリスト
```

## ローカルスケジューリング

### 自動実行方式
- **Linux/macOS**: cron または systemd timer
- **Windows**: Task Scheduler
- **クロスプラットフォーム**: PM2 または Docker

### 実行フロー
1. スケジューラーがNode.jsプロセス起動
2. dotenvで`.env`ファイルから環境変数読み込み
3. Obsidian API接続確認
4. RSS Feeder実行
5. Obsidian Vaultに直接ファイル作成
6. 完了ログ出力

## エラーハンドリング

### 階層的エラー処理
1. **フィード取得失敗**: 個別フィードをスキップ、継続実行
2. **Gemini API失敗**: 指数バックオフでリトライ、最終的にスキップ
3. **ファイル作成失敗**: リトライ後、エラーログ
4. **システム全体失敗**: ローカル実行失敗、ログ出力

### ログ管理
- 構造化ログ（タイムスタンプ付き）
- レベル別出力（info, warn, error）
- デバッグモードで詳細出力

## セキュリティ考慮事項

### API キー管理
- `.env` ファイルでローカル管理（`.gitignore` で除外済み）
- 環境変数経由でのアクセス
- ソースコードに機密情報含まず
- `.env.example` でテンプレート提供

### ネットワークセキュリティ
- HTTPS通信のみ
- タイムアウト設定
- User-Agent 設定

## 制限事項

### ローカル実行制限
- Obsidianが起動している必要がある
- Local REST APIプラグインが有効である必要がある
- ローカルマシンの稼働時間に依存

### API制限
- Gemini API: レート制限・クォータ
- RSS フィード: サーバー側制限
- Obsidian API: ローカルネットワーク接続のみ

## パフォーマンス最適化

### 並列処理
- フィード取得の並列実行
- Promise.allSettled でエラー分離

### キャッシュ戦略
- 重複記事の除去
- 当日記事のみ処理

### リソース管理
- メモリ効率的な処理
- ストリーミング処理 (必要時)

## 監視・運用

### ヘルスチェック
- Gemini API接続テスト
- 基本機能確認
- 手動実行可能

### メトリクス
- 処理記事数
- 生成カテゴリ数
- 実行時間
- エラー率

### メンテナンス
- フィードリスト定期見直し
- APIキー更新
- 依存関係更新
- 出力ファイル定期クリーンアップ

## 拡張性

### 新機能追加ポイント
- タグ分類システムの拡張
- 要約アルゴリズムの改善
- 出力形式の追加
- 通知システムの追加

### 設定可能項目
- タグ階層のカスタマイズ
- 要約テンプレートの変更
- フィルタリング条件の調整
- 出力形式の選択
