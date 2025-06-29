# ローカルスケジューラー設定ガイド

RSS Feederをローカルで定期実行するためのスケジューラー設定方法

## 前提条件

- Node.js 18以上がインストール済み
- Obsidian Local REST APIプラグインが設定済み
- 環境変数が設定済み

## 1. macOS / Linux (cron)

### crontabの設定
```bash
# crontab編集
crontab -e

# 毎日8:00にRSS Feederを実行
0 8 * * * cd /path/to/personal-rss && /usr/local/bin/node src/main.js >> /tmp/rss-feeder.log 2>&1
```

### 環境変数付きcron設定例
```bash
# 環境変数を含む実行スクリプト作成（.envファイル推奨）
cat > ~/run-rss-feeder.sh << 'EOF'
#!/bin/bash
export PATH="/usr/local/bin:$PATH"
cd /path/to/personal-rss
# .envファイルが設定済みの場合、追加の環境変数設定は不要
node src/main.js
EOF

# 実行権限付与
chmod +x ~/run-rss-feeder.sh

# crontab設定
echo "0 8 * * * /home/user/run-rss-feeder.sh >> /tmp/rss-feeder.log 2>&1" | crontab -
```

### systemd timer (Linux推奨)
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
# .envファイルを使用する場合、環境変数設定は不要
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

# タイマー有効化
sudo systemctl daemon-reload
sudo systemctl enable rss-feeder.timer
sudo systemctl start rss-feeder.timer

# 状態確認
sudo systemctl status rss-feeder.timer
```

## 2. Windows (Task Scheduler)

### PowerShellスクリプト作成
```powershell
# rss-feeder.ps1
# .envファイルを使用する場合、環境変数設定は不要
Set-Location "C:\path\to\personal-rss"
node src/main.js
```

### Task Scheduler設定
```powershell
# 管理者権限でPowerShell実行
$TaskName = "RSS Feeder"
$TaskPath = "C:\path\to\rss-feeder.ps1"

# タスク作成
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File `"$TaskPath`""
$Trigger = New-ScheduledTaskTrigger -Daily -At "08:00"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Daily RSS Feed Processing"
```

### GUIでの設定
1. `Windows + R` → `taskschd.msc`
2. 「基本タスクの作成」をクリック
3. **名前**: RSS Feeder
4. **トリガー**: 毎日
5. **時刻**: 8:00 AM
6. **操作**: プログラムの開始
7. **プログラム**: `PowerShell.exe`
8. **引数**: `-ExecutionPolicy Bypass -File "C:\path\to\rss-feeder.ps1"`

## 3. Docker (クロスプラットフォーム)

### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY config/ ./config/

CMD ["node", "src/main.js"]
```

### docker-compose.yml
```yaml
version: '3.8'
services:
  rss-feeder:
    build: .
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - OBSIDIAN_API_KEY=${OBSIDIAN_API_KEY}
      - OBSIDIAN_API_URL=http://host.docker.internal:27123
    network_mode: host
    restart: "no"
```

### 定期実行設定
```bash
# cronでDocker実行
0 8 * * * cd /path/to/personal-rss && docker-compose up --build
```

## 4. PM2 (Node.js プロセス管理)

### PM2インストール
```bash
npm install -g pm2
```

### ecosystem.config.js
```javascript
module.exports = {
  apps: [{
    name: 'rss-feeder',
    script: 'src/main.js',
    cwd: '/path/to/personal-rss',
    env: {
      GEMINI_API_KEY: 'your-gemini-api-key',
      OBSIDIAN_API_KEY: 'your-obsidian-api-key'
    },
    cron_restart: '0 8 * * *',
    autorestart: false,
    watch: false
  }]
};
```

### PM2実行
```bash
# 設定ファイルでアプリ起動
pm2 start ecosystem.config.js

# 永続化
pm2 startup
pm2 save

# 状態確認
pm2 status
```

## 5. 実行確認とトラブルシューティング

### ログ確認
```bash
# 手動実行でテスト
node src/main.js

# ヘルスチェック
node src/main.js health

# デバッグモード
DEBUG=true node src/main.js test
```

### よくある問題

#### 1. Obsidian接続エラー
```bash
# Obsidianが起動しているか確認
curl http://127.0.0.1:27123/vault/

# プラグインの設定確認
# Obsidian > Settings > Community plugins > Local REST API
```

#### 2. 環境変数エラー
```bash
# 環境変数の確認
echo $GEMINI_API_KEY
echo $OBSIDIAN_API_KEY

# .envファイルの確認（推奨）
cat .env
# .envファイルがない場合は作成
cp .env.example .env
# .envファイルを編集してAPIキーを設定
```

#### 3. パーミッションエラー
```bash
# スクリプトの実行権限確認
chmod +x ~/run-rss-feeder.sh

# Node.jsパスの確認
which node
```

### 監視とアラート
```bash
# ログローテーション設定
logrotate /etc/logrotate.d/rss-feeder

# 失敗時の通知（例：メール送信）
if ! node src/main.js; then
  echo "RSS Feeder failed" | mail -s "RSS Feeder Error" user@example.com
fi
```

## 推奨設定

**Linux/macOS**: systemd timer または PM2
**Windows**: Task Scheduler
**開発環境**: cron または手動実行

各システムでの設定完了後、初回は手動実行でテストしてから自動実行を開始してください。