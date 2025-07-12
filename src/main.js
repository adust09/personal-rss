#!/usr/bin/env node

/**
 * Main CLI script
 * Handles command line interface for RSS feeder
 */

const RSSFeeder = require('./rssFeeder');

// CLI handling
async function main() {
  const feeder = new RSSFeeder();

  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'health':
      await feeder.healthCheck();
      break;

    case 'test':
      await feeder.testRun();
      break;

    case 'daemon': {
      const { startDaemon } = require('./daemon');
      await startDaemon();
      break;
    }

    case 'help':
      console.log(`
RSS Feeder - Personal RSS Processing Tool

Usage:
  node src/main.js [command]

Commands:
  (no command)  Run the full RSS processing pipeline once
  daemon        Run in daemon mode with scheduler (12-hour intervals)
  health        Run health check
  test          Run with limited data for testing
  help          Show this help

Configuration:
  config/feeds.json      Required: RSS feeds configuration file
  GEMINI_API_KEY         Required: Your Gemini API key (environment variable)
  OBSIDIAN_API_KEY       Required: Obsidian Local REST API key (environment variable)

Environment Variables:
  RSS_FEEDS              Optional: JSON array of RSS feed URLs (overrides feeds.json)
  OBSIDIAN_API_URL       Optional: Obsidian API URL (default: https://127.0.0.1:27124/)
  DEBUG                  Optional: Enable debug mode (true/false)
  TIMEZONE               Optional: Timezone (default: Asia/Tokyo)
  MAX_RETRIES            Optional: Max retry attempts (default: 3)
  GEMINI_REQUEST_DELAY   Optional: Delay between API calls in ms (default: 1000)

Scheduler Environment Variables:
  SCHEDULE_ENABLED       Optional: Enable scheduler for daemon mode (true/false)
  SCHEDULE_CRON          Optional: Cron pattern (default: "0 */12 * * *" - every 12 hours)
  SCHEDULE_TIMEZONE      Optional: Scheduler timezone (default: same as TIMEZONE)
  RUN_ON_START           Optional: Run immediately when daemon starts (true/false)

Example:
  # Setup Obsidian Local REST API plugin and get API key, then:
  export GEMINI_API_KEY="your-gemini-api-key"
  export OBSIDIAN_API_KEY="your-obsidian-api-key"
  node src/main.js
  
  # Run in daemon mode with 12-hour scheduling:
  export SCHEDULE_ENABLED=true
  node src/main.js daemon
  
  # Or use RSS_FEEDS environment variable:
  export RSS_FEEDS='["https://example.com/feed.xml"]'
  node src/main.js
      `);
      break;

    default:
      await feeder.run();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = RSSFeeder;
