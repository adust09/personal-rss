/**
 * Daemon mode for RSS feeder with scheduler functionality
 * Handles process management and graceful shutdown
 */

const RSSFeeder = require('./rssFeeder');
const Scheduler = require('./scheduler');
const config = require('./config');
const Utils = require('./utils');

class Daemon {
  constructor() {
    this.rssFeeder = new RSSFeeder();
    this.scheduler = new Scheduler(this.rssFeeder);
    this.isShuttingDown = false;
    
    // Setup signal handlers for graceful shutdown
    this.setupSignalHandlers();
  }

  /**
   * Start daemon mode
   */
  async start() {
    try {
      Utils.log('info', '🔄 Starting RSS Feeder in daemon mode...');
      
      // Validate that scheduler is enabled
      if (!config.isScheduleEnabled()) {
        Utils.log('error', 'Scheduler is not enabled. Set SCHEDULE_ENABLED=true to use daemon mode.');
        process.exit(1);
      }

      // Validate configuration
      this.rssFeeder.validateConfiguration();

      // Run initial execution if configured
      if (config.getRunOnStart()) {
        Utils.log('info', '🚀 Running initial execution...');
        await this.rssFeeder.run();
        Utils.log('info', '✅ Initial execution completed');
      }

      // Start scheduler
      this.scheduler.start();

      Utils.log('info', '✅ RSS Feeder daemon started successfully');
      Utils.log('info', '   Use Ctrl+C or send SIGTERM to stop gracefully');
      
      // Keep process alive
      this.keepAlive();

    } catch (error) {
      Utils.log('error', '❌ Failed to start daemon:', error.message);
      process.exit(1);
    }
  }

  /**
   * Stop daemon mode gracefully
   */
  async stop() {
    if (this.isShuttingDown) {
      Utils.log('warn', 'Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    Utils.log('info', '🛑 Shutting down RSS Feeder daemon...');

    try {
      // Stop scheduler
      if (this.scheduler.isSchedulerRunning()) {
        this.scheduler.stop();
        Utils.log('info', '✅ Scheduler stopped');
      }

      Utils.log('info', '✅ RSS Feeder daemon stopped gracefully');
      process.exit(0);
    } catch (error) {
      Utils.log('error', '❌ Error during shutdown:', error.message);
      process.exit(1);
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    // Handle SIGTERM (kill command)
    process.on('SIGTERM', () => {
      Utils.log('info', 'Received SIGTERM signal');
      this.stop();
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      Utils.log('info', 'Received SIGINT signal');
      this.stop();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      Utils.log('error', 'Uncaught exception:', error.message);
      if (config.isDebugMode()) {
        console.error('Full error details:', error);
      }
      this.stop();
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      Utils.log('error', 'Unhandled rejection at:', promise, 'reason:', reason);
      this.stop();
    });
  }

  /**
   * Keep process alive
   */
  keepAlive() {
    const keepAliveInterval = setInterval(() => {
      if (this.isShuttingDown) {
        clearInterval(keepAliveInterval);
        return;
      }

      // Optional: Log status every hour
      if (config.isDebugMode()) {
        const now = new Date();
        if (now.getMinutes() === 0 && now.getSeconds() === 0) {
          Utils.log('info', `💓 Daemon heartbeat: ${now.toLocaleString()}`);
        }
      }
    }, 1000);
  }

  /**
   * Get status information
   */
  getStatus() {
    return {
      isRunning: true,
      isShuttingDown: this.isShuttingDown,
      schedulerRunning: this.scheduler.isSchedulerRunning(),
      startTime: new Date(),
      scheduleEnabled: config.isScheduleEnabled(),
      cronSchedule: config.getScheduleCron()
    };
  }
}

// CLI handling for daemon mode
async function startDaemon() {
  const daemon = new Daemon();
  await daemon.start();
}

module.exports = { Daemon, startDaemon };