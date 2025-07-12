/**
 * Unit tests for Scheduler class
 */

const Scheduler = require('../../src/scheduler');

// Mock dependencies
jest.mock('node-cron');
jest.mock('../../src/config');
jest.mock('../../src/utils');

const cron = require('node-cron');
const config = require('../../src/config');
const Utils = require('../../src/utils');

describe('Scheduler', () => {
  let scheduler;
  let mockRSSFeeder;
  let mockTask;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock RSS feeder
    mockRSSFeeder = testUtils.createMockRSSFeeder();

    // Setup mock cron task
    mockTask = {
      start: jest.fn(),
      stop: jest.fn()
    };

    // Setup mock config defaults
    config.getScheduleCron.mockReturnValue('0 */12 * * *');
    config.getScheduleTimezone.mockReturnValue('Asia/Tokyo');

    // Setup mock Utils
    Utils.log = jest.fn();

    // Setup mock cron
    cron.validate.mockReturnValue(true);
    cron.schedule.mockReturnValue(mockTask);

    scheduler = new Scheduler(mockRSSFeeder);
  });

  describe('constructor', () => {
    test('should initialize with correct default values', () => {
      expect(scheduler.rssFeeder).toBe(mockRSSFeeder);
      expect(scheduler.task).toBeNull();
      expect(scheduler.isRunning).toBe(false);
    });
  });

  describe('isValidCronExpression', () => {
    test('should return true for valid cron expressions', () => {
      cron.validate.mockReturnValue(true);

      expect(scheduler.isValidCronExpression('0 */12 * * *')).toBe(true);
      expect(cron.validate).toHaveBeenCalledWith('0 */12 * * *');
    });

    test('should return false for invalid cron expressions', () => {
      cron.validate.mockReturnValue(false);

      expect(scheduler.isValidCronExpression('invalid')).toBe(false);
      expect(cron.validate).toHaveBeenCalledWith('invalid');
    });
  });

  describe('start', () => {
    test('should start scheduler with valid configuration', () => {
      scheduler.start();

      expect(cron.validate).toHaveBeenCalledWith('0 */12 * * *');
      expect(cron.schedule).toHaveBeenCalledWith('0 */12 * * *', expect.any(Function), {
        scheduled: false,
        timezone: 'Asia/Tokyo'
      });
      expect(mockTask.start).toHaveBeenCalled();
      expect(scheduler.isRunning).toBe(true);
      expect(scheduler.task).toBe(mockTask);
    });

    test('should log startup information', () => {
      scheduler.start();

      expect(Utils.log).toHaveBeenCalledWith('info', '🕒 Starting scheduler with pattern: 0 */12 * * * (Asia/Tokyo)');
      expect(Utils.log).toHaveBeenCalledWith('info', '📅 Next execution times:');
      expect(Utils.log).toHaveBeenCalledWith('info', '✅ Scheduler started successfully');
    });

    test('should throw error for invalid cron expression', () => {
      config.getScheduleCron.mockReturnValue('invalid-cron');
      cron.validate.mockReturnValue(false);

      expect(() => scheduler.start()).toThrow('Invalid cron expression: invalid-cron');
      expect(scheduler.isRunning).toBe(false);
      expect(scheduler.task).toBeNull();
    });
  });

  describe('stop', () => {
    test('should stop running scheduler', () => {
      // Start scheduler first
      scheduler.start();
      expect(scheduler.isRunning).toBe(true);

      // Stop scheduler
      scheduler.stop();

      expect(mockTask.stop).toHaveBeenCalled();
      expect(scheduler.task).toBeNull();
      expect(scheduler.isRunning).toBe(false);
      expect(Utils.log).toHaveBeenCalledWith('info', '🛑 Scheduler stopped');
    });

    test('should handle stopping when not running', () => {
      expect(scheduler.isRunning).toBe(false);

      scheduler.stop();

      expect(mockTask.stop).not.toHaveBeenCalled();
      expect(Utils.log).not.toHaveBeenCalledWith('info', '🛑 Scheduler stopped');
    });
  });

  describe('isSchedulerRunning', () => {
    test('should return false initially', () => {
      expect(scheduler.isSchedulerRunning()).toBe(false);
    });

    test('should return true when running', () => {
      scheduler.start();
      expect(scheduler.isSchedulerRunning()).toBe(true);
    });

    test('should return false after stopping', () => {
      scheduler.start();
      scheduler.stop();
      expect(scheduler.isSchedulerRunning()).toBe(false);
    });
  });

  describe('executeTask', () => {
    test('should execute RSS feeder successfully', async () => {
      const _startTime = new Date();

      await scheduler.executeTask();

      expect(mockRSSFeeder.run).toHaveBeenCalled();
      expect(Utils.log).toHaveBeenCalledWith('info', expect.stringContaining('🚀 Scheduled execution started at'));
      expect(Utils.log).toHaveBeenCalledWith('info', expect.stringContaining('✅ Scheduled execution completed in'));
    });

    test('should handle RSS feeder errors gracefully', async () => {
      const error = new Error('RSS feeder failed');
      mockRSSFeeder.run.mockRejectedValue(error);
      config.isDebugMode = jest.fn().mockReturnValue(false);

      await scheduler.executeTask();

      expect(Utils.log).toHaveBeenCalledWith('error', '❌ Scheduled execution failed:', 'RSS feeder failed');
      expect(config.isDebugMode).toHaveBeenCalled();
    });

    test('should log full error details in debug mode', async () => {
      const error = new Error('RSS feeder failed');
      mockRSSFeeder.run.mockRejectedValue(error);
      config.isDebugMode = jest.fn().mockReturnValue(true);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await scheduler.executeTask();

      expect(Utils.log).toHaveBeenCalledWith('error', '❌ Scheduled execution failed:', 'RSS feeder failed');
      expect(consoleSpy).toHaveBeenCalledWith('Full error details:', error);

      consoleSpy.mockRestore();
    });
  });

  describe('logNextExecutions', () => {
    test('should log next execution times for 12-hour schedule', () => {
      const cronSchedule = '0 */12 * * *';
      const timezone = 'Asia/Tokyo';

      scheduler.logNextExecutions(cronSchedule, timezone, 3);

      // Should log 3 execution times
      expect(Utils.log).toHaveBeenCalledWith('info', expect.stringContaining('1.'));
      expect(Utils.log).toHaveBeenCalledWith('info', expect.stringContaining('2.'));
      expect(Utils.log).toHaveBeenCalledWith('info', expect.stringContaining('3.'));
    });

    test('should handle errors gracefully', () => {
      const cronSchedule = 'invalid';
      const timezone = 'Asia/Tokyo';

      // The function doesn't actually throw errors for invalid cron in current implementation
      // It just logs the times. This test verifies it doesn't crash.
      expect(() => {
        scheduler.logNextExecutions(cronSchedule, timezone, 3);
      }).not.toThrow();
    });
  });
});
