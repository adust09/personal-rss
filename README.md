# RSS Feeder

GitHub Actionsで毎日RSSフィードを取得し、Gemini APIでタグ付けと要約を行い、マークダウンファイルを自動生成するシステム

## 🚀 クイックスタート

### 1. セットアップ
```bash
# 依存関係インストール
npm install

# GitHub Secrets設定
# Settings > Secrets > Actions で以下を設定：
# - GEMINI_API_KEY: Gemini API キー
# - RSS_FEEDS: ["https://example.com/feed.xml", "https://example2.com/rss"]
```

### 2. ローカル実行
```bash
# 環境変数設定
export GEMINI_API_KEY="your-api-key"
export RSS_FEEDS='["https://example.com/feed.xml"]'

# 実行
npm start

# テストモード（限定記事数）
node src/main.js test

# ヘルスチェック
node src/main.js health
```

### 3. 自動実行
- 毎日8:00 AM JST に自動実行
- GitHub Actions タブから手動実行も可能

## 📁 出力
```
output/RSS/2025-06-28/
├── index.md         # 日別概要
├── tech/
│   ├── ai.md        # AI関連記事
│   └── web.md       # Web開発関連
└── business.md      # ビジネス関連
```

## 🔧 設定

### 必須環境変数
- `GEMINI_API_KEY`: Gemini API キー
- `RSS_FEEDS`: RSSフィードURLのJSON配列

### オプション環境変数
- `OUTPUT_DIRECTORY`: 出力先 (default: `./output`)
- `DEBUG`: デバッグモード (default: `false`) 
- `GEMINI_REQUEST_DELAY`: API呼び出し間隔ms (default: `1000`)

## 📚 詳細情報
- [技術仕様書](doc.md) - システム詳細、API仕様、エラーハンドリング等
- [CLAUDE.md](CLAUDE.md) - Claude Code向け開発ガイド

## 🐛 トラブルシューティング

### よくある問題
- **GitHub Actions失敗**: GitHub Secretsの設定確認
- **Gemini API エラー**: APIキーとクォータ確認
- **RSS取得失敗**: フィードURLの有効性確認

### デバッグ実行
```bash
export DEBUG=true
node src/main.js test
```