# RSS Feeder スケジューラー設定ガイド

RSS Feederの定期実行を設定するための包括的なガイドです。内蔵デーモンモードとtmuxを使った最新の推奨方法から、従来の外部スケジューラー方式まで網羅しています。

## 前提条件

- Node.js 18以上がインストール済み
- Obsidian Local REST APIプラグインが設定済み
- 必要な環境変数が設定済み（`GEMINI_API_KEY`, `OBSIDIAN_API_KEY`）
- **tmux がインストール済み**（推奨方法で必要）

### tmux インストール

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux

# CentOS/RHEL/Fedora
sudo yum install tmux
# または
sudo dnf install tmux

# バージョン確認
tmux -V
```

## 🌟 推奨方法：tmux + 内蔵デーモンモード

**最も簡単で安定した方法**です。外部スケジューラー設定が不要で、ターミナルを閉じても安全にデーモンが動作します。

### クイックスタート（3ステップ）

```bash
# 1. tmuxセッション作成
tmux new-session -s rss-feeder

# 2. 環境変数設定
export SCHEDULE_ENABLED=true
export GEMINI_API_KEY="your-api-key"
export OBSIDIAN_API_KEY="your-api-key"

# 3. デーモン起動（12時間ごと自動実行）
npm run daemon

# 4. デタッチ（ターミナル閉じてもOK）
Ctrl + B, d
```

### 詳細設定手順

#### 1. RSS Feeder用tmuxセッション作成

```bash
# 専用セッション作成
tmux new-session -s rss-feeder -c /path/to/personal-rss

# 複数ウィンドウで管理する場合
tmux rename-window -t rss-feeder:0 'daemon'
tmux new-window -t rss-feeder -n 'logs'
tmux new-window -t rss-feeder -n 'monitor'
```

#### 2. 環境変数設定

```bash
# セッション内で環境変数設定
export SCHEDULE_ENABLED=true
export GEMINI_API_KEY="your-actual-gemini-api-key"
export OBSIDIAN_API_KEY="your-actual-obsidian-api-key"

# オプション設定
export SCHEDULE_CRON="0 */12 * * *"    # 12時間ごと（デフォルト）
export RUN_ON_START=true               # 起動時即座実行
export DEBUG=true                      # デバッグモード
```

#### 3. 監視機能付きデーモン起動

```bash
# デーモンウィンドウを分割（推奨）
# ┌─────────────┬─────────────┐
# │   Daemon    │    Logs     │
# │             ├─────────────┤
# │             │   Monitor   │
# └─────────────┴─────────────┘

# ウィンドウを縦分割
Ctrl + B, %

# 右側を横分割
Ctrl + B, "

# 左ペイン: デーモン実行
npm run daemon

# 右上ペイン: ログ監視（別ペインで）
tail -f /tmp/rss-feeder.log

# 右下ペイン: システム監視（別ペインで）
watch -n 10 "ps aux | grep node"
```

#### 4. セッション管理

```bash
# デタッチ（セッションから離脱）
Ctrl + B, d

# セッション一覧確認
tmux list-sessions

# セッション再接続
tmux attach-session -t rss-feeder

# セッション終了
tmux kill-session -t rss-feeder
```

### 自動起動スクリプト

#### RSS Feeder起動スクリプト作成

```bash
#!/bin/bash
# ~/bin/rss-start.sh

RSS_SESSION="rss-feeder"
RSS_PATH="/path/to/personal-rss"

# 既存セッションチェック
if tmux has-session -t $RSS_SESSION 2>/dev/null; then
    echo "RSS Feeder session already running. Attaching..."
    tmux attach-session -t $RSS_SESSION
    exit 0
fi

echo "Creating new RSS Feeder session..."
cd $RSS_PATH

# セッション作成
tmux new-session -d -s $RSS_SESSION

# ウィンドウ設定
tmux rename-window -t $RSS_SESSION:0 'daemon'
tmux new-window -t $RSS_SESSION -n 'logs'

# メインウィンドウを3分割
tmux select-window -t $RSS_SESSION:daemon
tmux split-window -h
tmux split-window -t $RSS_SESSION:daemon.1 -v

# 環境変数設定とデーモン起動
tmux send-keys -t $RSS_SESSION:daemon.0 'export SCHEDULE_ENABLED=true' C-m
tmux send-keys -t $RSS_SESSION:daemon.0 'export GEMINI_API_KEY="your-api-key"' C-m
tmux send-keys -t $RSS_SESSION:daemon.0 'export OBSIDIAN_API_KEY="your-api-key"' C-m
tmux send-keys -t $RSS_SESSION:daemon.0 'npm run daemon'

# ログ監視設定
tmux send-keys -t $RSS_SESSION:daemon.1 'tail -f /tmp/rss-feeder.log' C-m

# システム監視設定
tmux send-keys -t $RSS_SESSION:daemon.2 'watch -n 10 "ps aux | grep rss"' C-m

echo "RSS Feeder session created. Use 'tmux attach-session -t rss-feeder' to connect."
```

#### エイリアス設定

```bash
# ~/.bashrc または ~/.zshrc に追加
chmod +x ~/bin/rss-start.sh

alias rss-start='~/bin/rss-start.sh'
alias rss-attach='tmux attach-session -t rss-feeder'
alias rss-stop='tmux kill-session -t rss-feeder'
alias rss-status='tmux list-sessions | grep rss-feeder || echo "No RSS session found"'
```

### カスタム設定例

#### 異なるスケジュール間隔

```bash
# 6時間ごと（1日4回）
export SCHEDULE_CRON="0 */6 * * *"

# 8時間ごと（1日3回）
export SCHEDULE_CRON="0 */8 * * *"

# 1時間ごと（開発・テスト用）
export SCHEDULE_CRON="0 * * * *"

# 毎日午前8時のみ
export SCHEDULE_CRON="0 8 * * *"
```

#### 時間別ファイル生成

```bash
# 12時間ごと実行で時間別ファイル生成
export ENABLE_HOURLY_FILES=true

# 生成されるファイル例:
# output/RSS/2025-07-03/tech/ai-2025-07-03-00.md  # 午前0時実行分
# output/RSS/2025-07-03/tech/ai-2025-07-03-12.md  # 正午実行分
```

### 運用・監視

#### 日常的な確認コマンド

```bash
# セッション状態確認
rss-status

# デーモンログ確認
rss-attach
# ログペインを確認後デタッチ
Ctrl + B, d

# プロセス直接確認
ps aux | grep "node src/main.js daemon"
```

#### 健康チェック

```bash
# RSS Feederセッション内で
npm run health

# または
node src/main.js health
```

#### トラブル時の対応

```bash
# デーモン再起動
rss-attach
# デーモンペインで Ctrl+C
npm run daemon

# セッション完全リセット
rss-stop
rss-start
```

## レガシー方法：外部スケジューラー

従来の外部スケジューラーを使用する方法です。上記の内蔵デーモンモードが利用できない環境でご使用ください。

### macOS / Linux (cron)

#### 基本的なcrontab設定

```bash
# crontab編集
crontab -e

# 毎日8:00に一度だけ実行
0 8 * * * cd /path/to/personal-rss && node src/main.js >> /tmp/rss-feeder.log 2>&1

# 12時間ごとに実行（デーモンモードを使わない場合）
0 */12 * * * cd /path/to/personal-rss && ENABLE_HOURLY_FILES=true node src/main.js >> /tmp/rss-feeder.log 2>&1
```

#### 環境変数付きスクリプト

```bash
# スクリプト作成
cat > ~/run-rss-feeder.sh << 'EOF'
#!/bin/bash
export PATH="/usr/local/bin:$PATH"
cd /path/to/personal-rss
export GEMINI_API_KEY="your-api-key"
export OBSIDIAN_API_KEY="your-api-key"
node src/main.js
EOF

chmod +x ~/run-rss-feeder.sh

# crontab設定
echo "0 8 * * * /home/user/run-rss-feeder.sh >> /tmp/rss-feeder.log 2>&1" | crontab -
```

### systemd timer (Linux)

```bash
# サービスファイル作成
sudo tee /etc/systemd/system/rss-feeder.service << 'EOF'
[Unit]
Description=RSS Feeder Service
After=network.target

[Service]
Type=oneshot
User=your-username
WorkingDirectory=/path/to/personal-rss
Environment=GEMINI_API_KEY=your-api-key
Environment=OBSIDIAN_API_KEY=your-api-key
ExecStart=/usr/bin/node src/main.js
StandardOutput=journal
StandardError=journal
EOF

# タイマーファイル作成
sudo tee /etc/systemd/system/rss-feeder.timer << 'EOF'
[Unit]
Description=RSS Feeder Timer
Requires=rss-feeder.service

[Timer]
OnCalendar=*-*-* 08:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# 有効化
sudo systemctl daemon-reload
sudo systemctl enable rss-feeder.timer
sudo systemctl start rss-feeder.timer
```

### Windows (Task Scheduler)

```powershell
# PowerShellスクリプト作成 (rss-feeder.ps1)
$env:GEMINI_API_KEY = "your-api-key"
$env:OBSIDIAN_API_KEY = "your-api-key"
Set-Location "C:\path\to\personal-rss"
node src/main.js

# タスクスケジューラー登録
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"C:\path\to\rss-feeder.ps1`""
$Trigger = New-ScheduledTaskTrigger -Daily -At "08:00"
Register-ScheduledTask -TaskName "RSS Feeder" -Action $Action -Trigger $Trigger
```

### PM2 (Node.js プロセス管理)

```bash
# PM2インストール
npm install -g pm2

# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'rss-feeder',
    script: 'src/main.js',
    env: {
      GEMINI_API_KEY: 'your-api-key',
      OBSIDIAN_API_KEY: 'your-api-key'
    },
    cron_restart: '0 8 * * *',
    autorestart: false
  }]
};

# 起動
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

## 🔄 マイグレーションガイド

既存の外部スケジューラー設定から内蔵デーモンモードへの移行手順です。

### 事前準備

```bash
# 1. tmuxインストール確認
tmux -V

# 2. 現在の設定バックアップ
crontab -l > ~/crontab-backup.txt  # cron使用の場合

# 3. RSS Feederアップデート確認
npm test
```

### 移行手順

#### Step 1: 外部スケジューラー停止

```bash
# cron無効化
crontab -r

# systemd停止（使用している場合）
sudo systemctl stop rss-feeder.timer
sudo systemctl disable rss-feeder.timer

# PM2停止（使用している場合）
pm2 stop rss-feeder
pm2 delete rss-feeder
```

#### Step 2: 内蔵デーモンモード起動

```bash
# tmuxセッション作成・デーモン起動
rss-start  # 上記で作成したスクリプト使用

# または手動で
tmux new-session -s rss-feeder
export SCHEDULE_ENABLED=true
npm run daemon
Ctrl + B, d
```

#### Step 3: 動作確認

```bash
# セッション状態確認
rss-status

# ログ確認
rss-attach
# ログを確認後デタッチ

# 数時間後に実行確認
ls output/RSS/
```

### 設定の対応表

| 外部スケジューラー | 内蔵デーモンモード |
|---|---|
| `cron: 0 */12 * * *` | `SCHEDULE_CRON="0 */12 * * *"` |
| `ENABLE_HOURLY_FILES=true` | `ENABLE_HOURLY_FILES=true` |
| cronでの環境変数 | tmuxセッション内で設定 |
| systemdサービス | tmux永続セッション |
| PM2ログ管理 | tmuxペイン分割表示 |

## トラブルシューティング

### tmux関連の問題

#### セッションが見つからない
```bash
# セッション一覧確認
tmux ls

# 強制的に新規作成
tmux new-session -s rss-feeder
```

#### セッションに接続できない
```bash
# 他のユーザーがセッションを保持している場合
tmux attach-session -t rss-feeder -d

# セッション強制終了・再作成
tmux kill-session -t rss-feeder
rss-start
```

### デーモンモード関連の問題

#### デーモンが起動しない
```bash
# 環境変数確認
echo $SCHEDULE_ENABLED
echo $GEMINI_API_KEY

# スケジューラー有効化
export SCHEDULE_ENABLED=true

# 手動実行でテスト
npm start
```

#### スケジュール実行されない
```bash
# cron式確認
node -e "const cron = require('node-cron'); console.log(cron.validate('0 */12 * * *'));"

# システム時刻確認
date

# デバッグモード有効化
export DEBUG=true
npm run daemon
```

### 一般的な問題

#### Obsidian接続エラー
```bash
# Obsidian起動確認
curl https://127.0.0.1:27124/vault/

# プラグイン設定確認
# Obsidian > Settings > Community plugins > Local REST API
```

#### メモリ不足
```bash
# メモリ使用量確認
free -h

# Node.jsプロセス確認
ps aux | grep node

# 必要に応じてスワップ追加
sudo fallocate -l 2G /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 推奨設定

### 用途別推奨

| 用途 | 推奨方法 | 特徴 |
|---|---|---|
| **日常利用** | tmux + 内蔵デーモン | 最簡単・安定 |
| **本番運用** | tmux + 内蔵デーモン + 監視 | 高可用性 |
| **開発・テスト** | tmux + 短時間スケジュール | デバッグ容易 |
| **サーバー環境** | systemd + 内蔵デーモン | システム統合 |
| **レガシー環境** | cron + 一回実行 | 従来互換 |

### 最終推奨構成

```bash
# 最も推奨される構成
# 1. tmux + 内蔵デーモンモード
# 2. 12時間間隔（0:00, 12:00）
# 3. 監視ペイン付き
# 4. 自動起動スクリプト

# セットアップ例
rss-start  # 自動起動スクリプト実行
# → tmuxセッション作成
# → 分割ペインでデーモン・ログ・監視
# → 永続実行開始
```

この設定により、RSS Feederの安定した長期運用が簡単に実現できます。

---

**次のステップ**: 
1. tmuxをインストール
2. `rss-start` スクリプトを作成
3. RSS Feeder起動
4. デタッチして日常使用開始

何か問題が発生した場合は、上記のトラブルシューティングセクションを参照してください。