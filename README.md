# RSS Feeder - Local Server + Obsidian Integration

RSS feed processing system that runs on a local server and creates markdown files directly in an Obsidian Vault via the Obsidian Local REST API

## 🚀 Quick Start

### 1. Prerequisites
- **Obsidian**: Enable Local REST API plugin
- **Node.js**: 18 or higher
- **Environment**: Obsidian running on local machine

### 2. Obsidian Setup
```bash
# 1. Launch Obsidian
# 2. Settings > Community plugins > Browse
# 3. Install and enable "Local REST API"
# 4. Generate and copy API Key
```

### 3. Project Setup
```bash
# Install dependencies
npm install

# Environment variable setup (recommended: .env file)
cp .env.example .env
# Edit .env file to set API keys

# Or set environment variables directly
export GEMINI_API_KEY="your-gemini-api-key"
export OBSIDIAN_API_KEY="your-obsidian-api-key"

# Feed configuration (set enabled: true in config/feeds.json)
```

### 4. Execution
```bash
# Manual execution
npm start

# Health check (verify Obsidian connection)
node src/main.js health

# Test mode (limited number of articles)
node src/main.js test
```

### 5. Automated Execution Setup
- Refer to [Scheduler Setup Guide](scheduler-setup.md)
- cron, systemd timer, Windows Task Scheduler, etc.

## 📁 Output Directory
```
Obsidian Vault/
└── RSS/
    └── 2025-06-28/
        ├── index.md         # Daily overview
        ├── tech/
        │   ├── ai.md        # AI-related articles
        │   └── web.md       # Web development related
        └── business.md      # Business related
```

## 🔧 Configuration

### Environment Variable Setup (recommended: .env file)
```bash
# Copy .env.example to create .env file
cp .env.example .env
```

**Required Variables:**
- `GEMINI_API_KEY`: Gemini API key
- `OBSIDIAN_API_KEY`: Obsidian Local REST API key

### Feed Configuration (config/feeds.json)
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

### Optional Environment Variables
- `RSS_FEEDS`: JSON array of RSS feed URLs (takes precedence over feeds.json)
- `OBSIDIAN_API_URL`: Obsidian API URL (default: `https://127.0.0.1:27124/`)
- `DEBUG`: Debug mode (default: `false`)
- `GEMINI_MODEL`: Gemini model name (default: `gemini-2.5-flash`)
- `GEMINI_REQUEST_DELAY`: API call interval in ms (default: `1000`)

## 📚 Detailed Information
- [Technical Specifications](doc/doc.md) - System details, API specifications, error handling, etc.
- [Scheduler Setup](doc/scheduler-setup.md) - Automated execution setup methods
- [Test Specifications](doc/test.md) - Unit test items
- [CLAUDE.md](CLAUDE.md) - Development guide for Claude Code

## 🐛 Troubleshooting

### Common Issues
- **Obsidian API Connection Failure**: Verify that Obsidian is running and Local REST API plugin is enabled
- **API Key Error**: Check that environment variables are correctly set
- **RSS Fetch Failure**: Verify feed URL validity

### Debug Execution
```bash
# Display detailed logs (set DEBUG=true in .env file or)
export DEBUG=true
node src/main.js test

# Obsidian connection test
curl -H "Authorization: Bearer YOUR_API_KEY" https://127.0.0.1:27124//vault/
```
