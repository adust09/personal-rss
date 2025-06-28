# RSS Feeder - 技術仕様書

## 概要
GitHub Actionsで毎日RSSフィードを取得し、Gemini APIでタグ付けと要約を行い、リポジトリにマークダウンファイルを作成するシステム

## システム構成

### プロジェクト構造
```
personal-rss/
├── src/
│   ├── main.js          # メインスクリプト
│   ├── config.js        # 設定管理
│   ├── feedFetcher.js   # RSSフィード取得
│   ├── llmProcessor.js  # Gemini API処理
│   ├── obsidianAPI.js   # ファイル出力システム
│   └── utils.js         # ユーティリティ関数
├── .github/workflows/
│   └── rss-feeder.yml   # GitHub Actions ワークフロー
├── config/
│   └── feeds.json       # フィード設定（オプション）
├── output/              # 出力ディレクトリ
└── package.json         # Node.js依存関係
```

### 技術スタック
- **実行環境**: GitHub Actions (Ubuntu Latest)
- **ランタイム**: Node.js 18+
- **依存関係**:
  - rss-parser: RSS/XMLパース
  - axios: HTTP リクエスト
  - date-fns: 日付操作
  - js-yaml: YAML frontmatter生成

## 処理フロー詳細

### 1. RSSフィード取得 (feedFetcher.js)
- 環境変数 `RSS_FEEDS` からフィードURLリストを読み込み
- `axios` でHTTPリクエスト実行
- `rss-parser` でXML解析
- エラーハンドリング: 失敗したフィードはスキップ
- 重複記事の除去（タイトル + リンクベース）
- 当日記事のフィルタリング

### 2. AI処理 (llmProcessor.js)
#### タグ付け処理
- Gemini API (`gemini-pro`) を使用
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

### 3. ファイル出力 (obsidianAPI.js)
- タグ階層に従ったディレクトリ構造作成
- YAML frontmatter付きマークダウン生成
- 日付別インデックスファイル作成
- 0件タグのファイル作成をスキップ

## 設定管理

### 環境変数
```bash
# 必須
GEMINI_API_KEY          # Gemini API キー
RSS_FEEDS              # RSSフィードURLのJSON配列

# オプション
OUTPUT_DIRECTORY       # 出力ディレクトリ (default: ./output)
DEBUG                  # デバッグモード (default: false)
TIMEZONE               # タイムゾーン (default: Asia/Tokyo)
MAX_RETRIES            # 最大リトライ回数 (default: 3)
GEMINI_REQUEST_DELAY   # API呼び出し間隔ms (default: 1000)
RETRY_DELAY            # リトライ間隔ms (default: 1000)
```

### GitHub Secrets設定
- `GEMINI_API_KEY`: Google AI Studio から取得
- `RSS_FEEDS`: JSON配列形式 `["url1", "url2"]`

## 出力形式

### ディレクトリ構造
```
output/RSS/YYYY-MM-DD/
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

## GitHub Actions ワークフロー

### スケジュール
- 毎日 8:00 AM JST (23:00 UTC) 自動実行
- 手動実行対応 (workflow_dispatch)
- テストモード実行対応

### 実行フロー
1. Node.js 18 環境セットアップ
2. 依存関係インストール
3. RSS Feeder実行
4. 出力ファイル確認
5. Git コミット・プッシュ
6. エラー時はアーティファクト保存

## エラーハンドリング

### 階層的エラー処理
1. **フィード取得失敗**: 個別フィードをスキップ、継続実行
2. **Gemini API失敗**: 指数バックオフでリトライ、最終的にスキップ
3. **ファイル作成失敗**: リトライ後、エラーログ
4. **システム全体失敗**: GitHub Actions失敗、通知

### ログ管理
- 構造化ログ（タイムスタンプ付き）
- レベル別出力（info, warn, error）
- デバッグモードで詳細出力

## セキュリティ考慮事項

### API キー管理
- GitHub Secrets で暗号化保存
- 環境変数経由でのアクセス
- ソースコードに機密情報含まず

### ネットワークセキュリティ
- HTTPS通信のみ
- タイムアウト設定
- User-Agent 設定

## 制限事項

### GitHub Actions制限
- 実行時間: 6時間（通常5-10分で完了）
- ストレージ: リポジトリサイズ制限
- 同時実行: 組織レベル制限

### API制限
- Gemini API: レート制限・クォータ
- RSS フィード: サーバー側制限

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