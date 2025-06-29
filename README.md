# RSS Feeder - Local Server + Obsidian Integration

ローカルサーバーで動作し、Obsidian Local REST API経由でObsidian Vaultに直接マークダウンファイルを作成するRSSフィード処理システム

## 🚀 クイックスタート

### 1. 前提条件
- **Obsidian**: Local REST APIプラグインを有効化
- **Node.js**: 18以上
- **環境**: ローカルマシンでObsidianが起動している

### 2. Obsidian設定
```bash
# 1. Obsidianを起動
# 2. Settings > Community plugins > Browse
# 3. "Local REST API" をインストール・有効化
# 4. API Keyを生成・コピー
```

### 3. プロジェクトセットアップ
```bash
# 依存関係インストール
npm install

# 環境変数設定（.envファイル推奨）
cp .env.example .env
# .envファイルを編集してAPIキーを設定

# または直接環境変数設定
export GEMINI_API_KEY="your-gemini-api-key"
export OBSIDIAN_API_KEY="your-obsidian-api-key"

# フィード設定（config/feeds.json で enabled: true に設定）
```

### 4. 実行
```bash
# 手動実行
npm start

# ヘルスチェック（Obsidian接続確認）
node src/main.js health

# テストモード（限定記事数）
node src/main.js test
```

### 5. 自動実行設定
- [スケジューラー設定ガイド](scheduler-setup.md)参照
- cron、systemd timer、Windows Task Schedulerなど

## 📁 出力先
```
Obsidian Vault/
└── RSS/
    └── 2025-06-28/
        ├── index.md         # 日別概要
        ├── tech/
        │   ├── ai.md        # AI関連記事
        │   └── web.md       # Web開発関連
        └── business.md      # ビジネス関連
```

## 🔧 設定

### 環境変数設定（.env ファイル推奨）
```bash
# .env.example をコピーして .env ファイルを作成
cp .env.example .env
```

**必須変数:**
- `GEMINI_API_KEY`: Gemini API キー
- `OBSIDIAN_API_KEY`: Obsidian Local REST API キー

### フィード設定 (config/feeds.json)
```json
{
  "feeds": [
    {
      "name": "TechCrunch",
      "url": "https://techcrunch.com/feed/",
      "description": "Tech and startup news",
      "enabled": true
    }
  ]
}
```

### オプション環境変数
- `RSS_FEEDS`: RSSフィードURLのJSON配列 (feeds.jsonより優先)
- `OBSIDIAN_API_URL`: Obsidian API URL (default: `https://127.0.0.1:27124/`)
- `DEBUG`: デバッグモード (default: `false`)
- `GEMINI_MODEL`: Geminiモデル名 (default: `gemini-2.5-flash`)
- `GEMINI_REQUEST_DELAY`: API呼び出し間隔ms (default: `1000`)

## 📚 詳細情報
- [技術仕様書](doc/doc.md) - システム詳細、API仕様、エラーハンドリング等
- [スケジューラー設定](doc/scheduler-setup.md) - 自動実行設定方法
- [テスト仕様](doc/test.md) - ユニットテスト項目
- [CLAUDE.md](CLAUDE.md) - Claude Code向け開発ガイド

## 🐛 トラブルシューティング

### よくある問題
- **Obsidian API接続失敗**: Obsidianが起動してLocal REST APIプラグインが有効か確認
- **API Key エラー**: 環境変数が正しく設定されているか確認
- **RSS取得失敗**: フィードURLの有効性確認

### デバッグ実行
```bash
# 詳細ログ表示（.envファイルでDEBUG=trueに設定するか）
export DEBUG=true
node src/main.js test

# Obsidian接続テスト
curl -H "Authorization: Bearer YOUR_API_KEY" https://127.0.0.1:27124//vault/
```
