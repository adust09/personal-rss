# RSS Feeder スケジューラー機能テストガイド

## 概要

RSS Feederのスケジューラー機能（daemon mode）の手動テストガイドです。自動テストでカバーしきれない実際の動作確認を行います。

## 前提条件

### 必要な環境設定
```bash
# 必須環境変数
export GEMINI_API_KEY="your-actual-gemini-api-key"
export OBSIDIAN_API_KEY="your-actual-obsidian-api-key"

# RSS feeds設定（config/feeds.jsonまたは環境変数）
export RSS_FEEDS='["https://example.com/feed.xml"]'
```

### Obsidian Local REST API設定
- Obsidianが起動している
- Local REST APIプラグインが有効
- APIキーが正しく設定されている

## テストケース

### 1. 基本動作テスト

#### 1.1 一度だけ実行（後方互換性確認）
```bash
# 従来の動作が維持されているか確認
npm start
```

**期待結果**:
- RSS処理が一度実行される
- 処理完了後にプロセスが終了する
- ログにスケジューラー関連の出力がない

#### 1.2 daemon mode起動
```bash
# スケジューラー有効化
export SCHEDULE_ENABLED=true

# daemon mode起動
npm run daemon
```

**期待結果**:
```
🔄 Starting RSS Feeder in daemon mode...
🔧 Validating configuration...
🕒 Starting scheduler with pattern: 0 */12 * * * (Asia/Tokyo)
📅 Next execution times:
   1. [次回実行時間]
   2. [次々回実行時間]
   3. [3回目実行時間]
✅ Scheduler started successfully
✅ RSS Feeder daemon started successfully
   Use Ctrl+C or send SIGTERM to stop gracefully
```

#### 1.3 グレースフルシャットダウン
daemon mode起動後、`Ctrl+C`で停止

**期待結果**:
```
Received SIGINT signal
🛑 Shutting down RSS Feeder daemon...
✅ Scheduler stopped
✅ RSS Feeder daemon stopped gracefully
```

### 2. 設定テスト

#### 2.1 カスタムcronスケジュール
```bash
export SCHEDULE_ENABLED=true
export SCHEDULE_CRON="*/30 * * * * *"  # 30秒ごと（テスト用）

npm run daemon
```

**期待結果**:
- 30秒ごとにRSS処理が実行される
- ログに実行開始・完了が記録される

#### 2.2 初回実行設定
```bash
export SCHEDULE_ENABLED=true
export RUN_ON_START=true

npm run daemon
```

**期待結果**:
- daemon起動直後にRSS処理が一度実行される
- その後はスケジュール通りに実行される

#### 2.3 タイムゾーン設定
```bash
export SCHEDULE_ENABLED=true
export SCHEDULE_TIMEZONE="America/New_York"

npm run daemon
```

**期待結果**:
- ログにタイムゾーンが表示される
- 次回実行時間がニューヨーク時間で計算される

### 3. エラーハンドリングテスト

#### 3.1 スケジューラー無効でdaemon起動
```bash
export SCHEDULE_ENABLED=false  # または未設定

npm run daemon
```

**期待結果**:
```
🔄 Starting RSS Feeder in daemon mode...
Scheduler is not enabled. Set SCHEDULE_ENABLED=true to use daemon mode.
```
- プロセスがexit code 1で終了

#### 3.2 不正なcron式
```bash
export SCHEDULE_ENABLED=true
export SCHEDULE_CRON="invalid-cron-expression"

npm run daemon
```

**期待結果**:
```
❌ Failed to start daemon: Invalid cron expression: invalid-cron-expression
```

#### 3.3 必須環境変数未設定
```bash
unset GEMINI_API_KEY

npm run daemon
```

**期待結果**:
```
❌ Failed to start daemon: Missing required environment variables: GEMINI_API_KEY
```

### 4. 実際のRSS処理テスト

#### 4.1 短時間スケジュールでの動作確認
```bash
export SCHEDULE_ENABLED=true
export SCHEDULE_CRON="*/2 * * * *"  # 2分ごと
export DEBUG=true

npm run daemon
```

**テスト手順**:
1. daemon起動
2. 2分待機
3. RSS処理が自動実行されることを確認
4. 出力ディレクトリにファイルが生成されることを確認
5. ログでスケジュール実行を確認

**期待結果**:
```
🚀 Scheduled execution started at [時刻]
📰 Fetching RSS feeds...
🤖 Processing articles with Gemini API...
📁 Generating output files...
✅ Scheduled execution completed in [秒数] seconds
```

#### 4.2 エラー発生時の継続動作
一時的にObsidianを停止してエラーを発生させ、その後復旧

**期待結果**:
- エラーが発生してもdaemonプロセスは継続
- エラーログが適切に出力される
- 次回スケジュール実行は正常に試行される

### 5. CLI機能テスト

#### 5.1 ヘルプ表示
```bash
node src/main.js help
```

**期待結果**:
- daemon commandの説明が含まれている
- スケジューラー関連環境変数の説明がある

#### 5.2 健康チェック
```bash
node src/main.js health
```

**期待結果**:
- 既存のhealth check機能が正常動作
- daemon機能追加の影響がない

#### 5.3 テストモード
```bash
node src/main.js test
```

**期待結果**:
- 既存のtest機能が正常動作
- daemon機能追加の影響がない

### 6. npm スクリプトテスト

#### 6.1 npm scripts動作確認
```bash
# 各スクリプトが正常動作することを確認
npm start
npm run daemon
npm test
npm run test:coverage
```

### 7. パフォーマンステスト

#### 7.1 長時間稼働テスト
```bash
export SCHEDULE_ENABLED=true
export SCHEDULE_CRON="0 */1 * * *"  # 1時間ごと

npm run daemon
```

**テスト手順**:
1. daemon起動
2. 数時間放置
3. メモリリークがないか確認
4. ログが適切に出力されているか確認

### 8. プロセス管理テスト

#### 8.1 シグナルハンドリング
```bash
# 別ターミナルで実行
ps aux | grep "node src/main.js daemon"
kill -TERM [PID]
```

**期待結果**:
- SIGTERM受信でグレースフルシャットダウン
- 適切な終了ログ出力

#### 8.2 プロセス監視
```bash
# daemon起動後、プロセス状態を監視
top -p [PID]
```

**確認ポイント**:
- CPUやメモリ使用量が適切
- プロセスが安定して動作

## トラブルシューティング

### よくある問題

#### 1. daemon起動失敗
- 環境変数設定を確認
- Obsidian Local REST APIの状態確認
- ログでエラー詳細を確認

#### 2. スケジュール実行されない
- cron式の構文確認
- タイムゾーン設定確認
- システム時刻確認

#### 3. 予期しない終了
- ログで終了原因確認
- システムリソース状況確認
- エラーハンドリングの動作確認

### デバッグ方法

#### 詳細ログ出力
```bash
export DEBUG=true
npm run daemon
```

#### テスト用短時間スケジュール
```bash
export SCHEDULE_CRON="*/30 * * * * *"  # 30秒ごと
npm run daemon
```

## テスト完了チェックリスト

- [ ] 基本動作（起動・停止）
- [ ] 後方互換性（npm start）
- [ ] カスタム設定動作
- [ ] エラーハンドリング
- [ ] 実際のRSS処理
- [ ] CLI機能
- [ ] npm スクリプト
- [ ] 長時間稼働
- [ ] プロセス管理

## 自動テスト実行

```bash
# 全テスト実行
npm test

# カバレッジ付きテスト
npm run test:coverage

# 監視モード
npm run test:watch
```

## 報告事項

テスト完了時は以下を報告：

1. **成功したテストケース**: 正常動作確認項目
2. **失敗したテストケース**: エラー内容と再現手順
3. **パフォーマンス**: 長時間稼働時のリソース使用状況
4. **改善提案**: 使いやすさ・安定性向上のアイデア