# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RSS Feeder - Google Apps Script system that fetches RSS feeds daily, processes articles with Gemini API for tagging and summarization, and creates organized markdown files in Obsidian via Local REST API.

## Architecture

This is a Google Apps Script (GAS) project with the following planned structure:
- `Code.gs` - Main orchestration script with daily trigger (8 AM)
- `Config.gs` - Configuration management via PropertiesService
- `FeedFetcher.gs` - RSS feed retrieval using UrlFetchApp and XmlService
- `LLMProcessor.gs` - Gemini API integration for tagging and summarization
- `ObsidianAPI.gs` - Obsidian Local REST API client (https://127.0.0.1:27123)
- `Utils.gs` - Utility functions

## Development Commands

Since this is a GAS project, development happens in the Google Apps Script web interface:

**Setup**:
- Deploy via Google Apps Script web interface
- Configure PropertiesService with API keys and feed URLs
- Set up daily trigger: `ScriptApp.newTrigger('main').timeBased().everyDays(1).atHour(8).create()`

**Configuration Management**:
- All settings managed via GAS PropertiesService
- Required keys: `gemini_api_key`, `obsidian_api_key`, `obsidian_api_url`, feed URLs list

**Testing**:
- Manual execution via GAS interface
- Log monitoring via GAS console
- Obsidian vault verification for output files

## Key Processing Flow

1. **Feed Retrieval**: Fetch RSS feeds using UrlFetchApp, parse with XmlService
2. **AI Processing**: Send article titles to Gemini API for hierarchical tagging (tech/ai, tech/web, cryptography, etc.)
3. **Grouping**: Group articles by tags
4. **Summarization**: Generate Japanese summaries for each tag group via Gemini API
5. **Obsidian Integration**: Create organized markdown files in vault via Local REST API

## Output Structure

Files created in Obsidian vault:
```
RSS/YYYY-MM-DD/
├── tech/
│   ├── ai.md
│   └── web.md
└── cryptography.md
```

Each markdown file includes YAML frontmatter with date, tag, article count, and tags array.

## External Dependencies

**Required APIs**:
- Gemini API for tagging and summarization
- Obsidian Local REST API plugin (port 27123)

**GAS Built-in Services**:
- UrlFetchApp (RSS fetching)
- XmlService (RSS parsing)
- PropertiesService (configuration)
- ScriptApp (trigger management)

## Important Constraints

**GAS Limitations**:
- 6-minute execution time limit
- API call rate limits
- Memory constraints for large datasets

**Language Requirements**:
- All summaries generated in Japanese, even for English articles
- Hierarchical tagging system with Japanese understanding

## Security Considerations

- API keys stored securely in GAS PropertiesService
- HTTPS endpoints for Obsidian Local REST API
- No sensitive data in source code

## Error Handling Strategy

- Feed fetch failures: Log and skip
- Gemini API failures: Log and skip
- Obsidian API failures: Log and retry (max 3 times)
- Zero articles per tag: Skip file creation

## Current Project State

**Status**: Specification phase - no implementation files exist yet
**Repository**: Contains only README.md (specification) and LICENSE
**Next Steps**: Implement GAS files according to specification