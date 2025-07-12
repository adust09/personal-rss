# Personal RSS Feeder - Local Server + Obsidian Integration

RSS feed processing system that runs on a local server and creates markdown files directly in an Obsidian Vault via the Obsidian Local REST API

## 🚀 Quick Start

### 1. Prerequisites

- **Obsidian**: Enable Local REST API plugin
- **Node.js**: 18 or higher
- **Environment**: Obsidian running on local machine
- **tmux**

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
npm run daemon

# Health check (verify Obsidian connection)
node src/main.js health

# Test mode (limited number of articles)
node src/main.js test
```

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

### Optional Environment Variables

- `RSS_FEEDS`: JSON array of RSS feed URLs (takes precedence over feeds.json)
- `OBSIDIAN_API_URL`: Obsidian API URL (default: `https://127.0.0.1:27124/`)
- `DEBUG`: Debug mode (default: `false`)
- `GEMINI_MODEL`: Gemini model name (default: `gemini-2.5-flash`)
- `GEMINI_REQUEST_DELAY`: API call interval in ms (default: `1000`)
