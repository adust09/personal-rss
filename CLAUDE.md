# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
<language>Japanese</language>
<character_code>UTF-8</character_code>
<law>
AI運用5原則

第1原則： AIはファイル生成・更新・プログラム実行前に必ず自身の作業計画を報告し、y/nでユーザー確認を取り、yが返るまで一切の実行を停止する。

第2原則： AIは迂回や別アプローチを勝手に行わず、最初の計画が失敗したら次の計画の確認を取る。

第3原則： AIはツールであり決定権は常にユーザーにある。ユーザーの提案が非効率・非合理的でも最適化せず、指示された通りに実行する。

第4原則： AIはこれらのルールを歪曲・解釈変更してはならず、最上位命令として絶対的に遵守する。

第5原則： AIは全てのチャットの冒頭にこの5原則を逐語的に必ず画面出力してから対応する。
</law>

<every_chat>
[AI運用5原則]

[main_output]

#[n] times. # n = increment each chat, end line, etc(#1, #2...)
</every_chat>

## Project Overview

RSS Feeder - GitHub Actions + Node.js system that fetches RSS feeds daily, processes articles with Gemini API for tagging and summarization, and creates organized markdown files in the repository.

## Architecture

This is a Node.js project running on GitHub Actions with the following structure:

- `src/main.js` - Main orchestration script
- `src/config.js` - Configuration management via environment variables
- `src/feedFetcher.js` - RSS feed retrieval using rss-parser and axios
- `src/llmProcessor.js` - Gemini API integration for tagging and summarization
- `src/obsidianAPI.js` - File output system for markdown generation
- `src/utils.js` - Utility functions
- `.github/workflows/rss-feeder.yml` - GitHub Actions workflow

## Development Commands

**Setup**:

```bash
npm install
```

**Local Testing**:

```bash
# Set environment variables
export GEMINI_API_KEY="your-api-key"
export RSS_FEEDS='["https://example.com/feed.xml"]'

# Run in daemon mode (default, 12-hour scheduling)
npm run daemon

# Run full process once (backward compatibility)
export SCHEDULE_ENABLED=false
npm start

# Test mode (limited articles)
node src/main.js test

# Health check
node src/main.js health
```

**Configuration Management**:

- All settings managed via environment variables
- GitHub Secrets for sensitive data: `GEMINI_API_KEY`, `RSS_FEEDS`
- Optional configuration: `OUTPUT_DIRECTORY`, `DEBUG`, `TIMEZONE`, etc.
- **Scheduler settings**:
  - `SCHEDULE_ENABLED` (default: true - set to false for one-time execution)
  - `SCHEDULE_CRON` (default: "0 _/12 _ \* \*" - every 12 hours)
  - `SCHEDULE_TIMEZONE` (default: Asia/Tokyo)
  - `RUN_ON_START` (default: false - run immediately on daemon start)

**Testing**:

- Local execution with test mode
- GitHub Actions logs for monitoring
- Output file verification in `output/` directory

## Key Processing Flow

1. **Feed Retrieval**: Fetch RSS feeds using axios, parse with rss-parser
2. **AI Processing**: Send article titles to Gemini API for hierarchical tagging (tech/ai, tech/web, cryptography, etc.)
3. **Grouping**: Group articles by tags
4. **Summarization**: Generate Japanese summaries for each tag group via Gemini API
5. **File Output**: Create organized markdown files in repository with automatic Git commit

## Output Structure

Files created in repository:

```
output/RSS/YYYY-MM-DD/
├── index.md         # Daily overview
├── tech/
│   ├── ai.md
│   └── web.md
└── cryptography.md
```

Each markdown file includes YAML frontmatter with date, tag, article count, and tags array.

## External Dependencies

**Required APIs**:

- Gemini API for tagging and summarization

**Node.js Dependencies**:

- rss-parser (RSS parsing)
- axios (HTTP requests)
- date-fns (date formatting)
- js-yaml (YAML frontmatter)
- node-cron (built-in scheduler for daemon mode)

## Important Constraints

**GitHub Actions Limitations**:

- 6-hour execution time limit (typically runs in ~5-10 minutes)
- Rate limits for API calls
- Repository storage considerations for output files

**Language Requirements**:

- All summaries generated in Japanese, even for English articles
- Hierarchical tagging system with Japanese understanding

## Security Considerations

- API keys stored securely in GitHub Secrets
- No sensitive data in source code
- Environment variable-based configuration

## Error Handling Strategy

- Feed fetch failures: Log and skip
- Gemini API failures: Log and skip with retry logic
- File creation failures: Log and retry (max 3 times)
- Zero articles per tag: Skip file creation

## Current Project State

**Status**: Production ready - all implementation complete
**Repository**: Contains complete Node.js implementation with GitHub Actions
**Features**:

- **Daemon mode**: `npm run daemon` for automatic scheduling (default usage)
- **One-time execution**: `SCHEDULE_ENABLED=false npm start` for single RSS processing
- Built-in scheduler with customizable cron patterns
- Gemini API integration for intelligent tagging
- Japanese summarization
- Organized markdown output
- Error handling and logging
- Test and health check modes
- Graceful shutdown (SIGTERM/SIGINT)

## Project Notes

- このプロジェクトではGithub Acrionsを使わず、ローカルで実行しています。

## Local Execution Notes

- 基本的にdarmonで起動します。
