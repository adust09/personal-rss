/**
 * Scheduler module for periodic RSS feed processing
 * Uses node-cron for scheduling functionality
 */

const cron = require('node-cron');
const config = require('./config');
const Utils = require('./utils');
const { INDICES, CRON } = require('./constants');

class Scheduler {
  constructor(rssFeeder) {
    this.rssFeeder = rssFeeder;
    this.task = null;
    this.isRunning = false;
  }

  /**
   * Start the scheduler with configured cron schedule
   */
  start() {
    const cronSchedule = config.getScheduleCron();
    const timezone = config.getScheduleTimezone();

    if (!this.isValidCronExpression(cronSchedule)) {
      throw new Error(`Invalid cron expression: ${cronSchedule}`);
    }

    Utils.log('info', `🕒 Starting scheduler with pattern: ${cronSchedule} (${timezone})`);
    Utils.log('info', '📅 Next execution times:');

    // Show next 3 execution times
    this.logNextExecutions(cronSchedule, timezone, INDICES.NEXT_EXECUTIONS_DISPLAY_COUNT);

    this.task = cron.schedule(
      cronSchedule,
      async () => {
        await this.executeTask();
      },
      {
        scheduled: false,
        timezone: timezone
      }
    );

    this.task.start();
    this.isRunning = true;

    Utils.log('info', '✅ Scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      this.isRunning = false;
      Utils.log('info', '🛑 Scheduler stopped');
    }
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning() {
    return this.isRunning;
  }

  /**
   * Execute RSS feed processing task
   */
  async executeTask() {
    const startTime = new Date();
    Utils.log('info', `🚀 Scheduled execution started at ${startTime.toLocaleString()}`);

    try {
      await this.rssFeeder.run();
      const endTime = new Date();
      const duration = Math.round((endTime - startTime) / 1000);
      Utils.log('info', `✅ Scheduled execution completed in ${duration} seconds`);
    } catch (error) {
      Utils.log('error', '❌ Scheduled execution failed:', error.message);

      if (config.isDebugMode()) {
        console.error('Full error details:', error);
      }
    }
  }

  /**
   * Validate cron expression
   */
  isValidCronExpression(expression) {
    return cron.validate(expression);
  }

  /**
   * Log next execution times for user information
   */
  logNextExecutions(cronSchedule, timezone, count = 3) {
    try {
      // Create a temporary task to get next execution times
      const _tempTask = cron.schedule(cronSchedule, () => {}, {
        scheduled: false,
        timezone: timezone
      });

      // Since node-cron doesn't have a built-in method to get next execution times,
      // we'll simulate the next few times based on current time
      const now = new Date();
      const times = [];

      // For 12-hour schedule (0 */12 * * *), show next 3 executions
      if (cronSchedule === CRON.TWELVE_HOUR_INTERVAL) {
        const currentHour = now.getHours();
        let nextHour = currentHour < 12 ? 12 : 24; // Next 12:00 or 00:00

        for (let i = 0; i < count; i++) {
          const nextTime = new Date(now);
          nextTime.setHours(nextHour % 24, 0, 0, 0);

          // If the time has passed today, move to next occurrence
          if (nextTime <= now) {
            nextTime.setDate(nextTime.getDate() + 1);
          }

          times.push(nextTime.toLocaleString());
          nextHour += 12;

          // Move to next day if needed
          if (nextHour >= 24) {
            nextTime.setDate(nextTime.getDate() + 1);
          }
        }
      }

      times.forEach((time, index) => {
        Utils.log('info', `   ${index + 1}. ${time}`);
      });
    } catch (error) {
      Utils.log('warn', 'Could not calculate next execution times');
    }
  }
}

module.exports = Scheduler;
