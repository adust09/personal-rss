# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Run full process
npm start

# Test mode (limited articles)
node src/main.js test

# Health check
node src/main.js health
```

**GitHub Actions**:
- Automatic daily execution at 8:00 AM JST (23:00 UTC)
- Manual execution via GitHub Actions interface
- Test mode available via workflow dispatch

**Configuration Management**:
- All settings managed via environment variables
- GitHub Secrets for sensitive data: `GEMINI_API_KEY`, `RSS_FEEDS`
- Optional configuration: `OUTPUT_DIRECTORY`, `DEBUG`, `TIMEZONE`, etc.

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
- Daily automated RSS processing
- Gemini API integration for intelligent tagging
- Japanese summarization
- Organized markdown output
- Error handling and logging
- Test and health check modes