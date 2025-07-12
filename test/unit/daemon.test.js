/**
 * Unit tests for Daemon class
 */

// Set environment variables before any imports
process.env.GEMINI_API_KEY = 'test-key';
process.env.OBSIDIAN_API_KEY = 'test-key';

// Mock dependencies before importing
jest.mock('../../src/rssFeeder', () => {
  return jest.fn().mockImplementation(() => ({
    run: jest.fn().mockResolvedValue(undefined),
    validateConfiguration: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    testRun: jest.fn().mockResolvedValue(undefined)
  }));
});
jest.mock('../../src/scheduler');
jest.mock('../../src/config');
jest.mock('../../src/utils');

const { Daemon } = require('../../src/daemon');

const RSSFeeder = require('../../src/rssFeeder');
const Scheduler = require('../../src/scheduler');
const config = require('../../src/config');
const Utils = require('../../src/utils');

describe('Daemon', () => {
  let daemon;
  let mockRSSFeeder;
  let mockScheduler;
  let mockProcessExit;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Remove all listeners to prevent conflicts
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');

    // Mock process.exit
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation();

    // Setup mock RSS feeder - RSSFeeder is already mocked above
    mockRSSFeeder = {
      run: jest.fn().mockResolvedValue(undefined),
      validateConfiguration: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue(true),
      testRun: jest.fn().mockResolvedValue(undefined)
    };
    RSSFeeder.mockImplementation(() => mockRSSFeeder);

    // Setup mock scheduler
    mockScheduler = {
      start: jest.fn(),
      stop: jest.fn(),
      isSchedulerRunning: jest.fn().mockReturnValue(false)
    };
    Scheduler.mockImplementation(() => mockScheduler);

    // Setup mock config defaults
    config.isScheduleEnabled.mockReturnValue(true);
    config.getRunOnStart.mockReturnValue(false);

    // Setup mock Utils
    Utils.log = jest.fn();

    daemon = new Daemon();
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
    // Remove all listeners to prevent memory leaks
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  describe('constructor', () => {
    test('should initialize with correct components', () => {
      expect(RSSFeeder).toHaveBeenCalled();
      expect(Scheduler).toHaveBeenCalledWith(mockRSSFeeder);
      expect(daemon.isShuttingDown).toBe(false);
    });
  });

  describe('start', () => {
    test('should start daemon successfully with scheduler enabled', async () => {
      await daemon.start();

      expect(Utils.log).toHaveBeenCalledWith('info', '🔄 Starting RSS Feeder in daemon mode...');
      expect(config.isScheduleEnabled).toHaveBeenCalled();
      expect(mockRSSFeeder.validateConfiguration).toHaveBeenCalled();
      expect(mockScheduler.start).toHaveBeenCalled();
      expect(Utils.log).toHaveBeenCalledWith('info', '✅ RSS Feeder daemon started successfully');
    });

    test('should exit if scheduler is not enabled', async () => {
      config.isScheduleEnabled.mockReturnValue(false);

      await daemon.start();

      expect(Utils.log).toHaveBeenCalledWith(
        'error',
        'Scheduler is not enabled. Set SCHEDULE_ENABLED=true to use daemon mode.'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      // Since process.exit(1) is called before scheduler.start(), we expect the scheduler
      // was created during constructor but start() was never reached
    });

    test('should run initial execution when configured', async () => {
      config.getRunOnStart.mockReturnValue(true);

      await daemon.start();

      expect(Utils.log).toHaveBeenCalledWith('info', '🚀 Running initial execution...');
      expect(mockRSSFeeder.run).toHaveBeenCalled();
      expect(Utils.log).toHaveBeenCalledWith('info', '✅ Initial execution completed');
    });

    test('should skip initial execution when not configured', async () => {
      config.getRunOnStart.mockReturnValue(false);

      await daemon.start();

      expect(mockRSSFeeder.run).not.toHaveBeenCalled();
      expect(Utils.log).not.toHaveBeenCalledWith('info', '🚀 Running initial execution...');
    });

    test('should handle configuration validation errors', async () => {
      const error = new Error('Configuration error');
      mockRSSFeeder.validateConfiguration.mockImplementation(() => {
        throw error;
      });

      await daemon.start();

      expect(Utils.log).toHaveBeenCalledWith('error', '❌ Failed to start daemon:', 'Configuration error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    test('should handle initial execution errors', async () => {
      config.getRunOnStart.mockReturnValue(true);
      const error = new Error('RSS execution failed');
      mockRSSFeeder.run.mockRejectedValue(error);

      await daemon.start();

      expect(Utils.log).toHaveBeenCalledWith('error', '❌ Failed to start daemon:', 'RSS execution failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('stop', () => {
    test('should stop daemon gracefully', async () => {
      // Setup running scheduler
      mockScheduler.isSchedulerRunning.mockReturnValue(true);

      await daemon.stop();

      expect(daemon.isShuttingDown).toBe(true);
      expect(Utils.log).toHaveBeenCalledWith('info', '🛑 Shutting down RSS Feeder daemon...');
      expect(mockScheduler.stop).toHaveBeenCalled();
      expect(Utils.log).toHaveBeenCalledWith('info', '✅ Scheduler stopped');
      expect(Utils.log).toHaveBeenCalledWith('info', '✅ RSS Feeder daemon stopped gracefully');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });

    test('should not stop scheduler if not running', async () => {
      mockScheduler.isSchedulerRunning.mockReturnValue(false);

      await daemon.stop();

      expect(mockScheduler.stop).not.toHaveBeenCalled();
      expect(Utils.log).not.toHaveBeenCalledWith('info', '✅ Scheduler stopped');
    });

    test('should handle multiple stop calls gracefully', async () => {
      // First stop call
      const firstStopPromise = daemon.stop();

      // Second stop call while first is in progress
      const secondStopPromise = daemon.stop();

      await Promise.all([firstStopPromise, secondStopPromise]);

      expect(Utils.log).toHaveBeenCalledWith('warn', 'Shutdown already in progress...');
    });

    test('should handle stop errors', async () => {
      const error = new Error('Stop error');
      mockScheduler.stop.mockImplementation(() => {
        throw error;
      });
      mockScheduler.isSchedulerRunning.mockReturnValue(true);

      await daemon.stop();

      expect(Utils.log).toHaveBeenCalledWith('error', '❌ Error during shutdown:', 'Stop error');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('setupSignalHandlers', () => {
    let mockProcessOn;

    beforeEach(() => {
      mockProcessOn = jest.spyOn(process, 'on').mockImplementation();
    });

    afterEach(() => {
      mockProcessOn.mockRestore();
    });

    test('should setup signal handlers during construction', () => {
      new Daemon();

      expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });

    test('should handle SIGTERM signal', () => {
      const daemon = new Daemon();
      daemon.stop = jest.fn();

      // Get the SIGTERM handler
      const sigtermHandler = mockProcessOn.mock.calls.find(call => call[0] === 'SIGTERM')[1];

      sigtermHandler();

      expect(Utils.log).toHaveBeenCalledWith('info', 'Received SIGTERM signal');
      expect(daemon.stop).toHaveBeenCalled();
    });

    test('should handle SIGINT signal', () => {
      const daemon = new Daemon();
      daemon.stop = jest.fn();

      // Get the SIGINT handler
      const sigintHandler = mockProcessOn.mock.calls.find(call => call[0] === 'SIGINT')[1];

      sigintHandler();

      expect(Utils.log).toHaveBeenCalledWith('info', 'Received SIGINT signal');
      expect(daemon.stop).toHaveBeenCalled();
    });

    test('should handle uncaught exceptions', () => {
      const daemon = new Daemon();
      daemon.stop = jest.fn();
      config.isDebugMode = jest.fn().mockReturnValue(false);

      const error = new Error('Uncaught error');
      const uncaughtHandler = mockProcessOn.mock.calls.find(call => call[0] === 'uncaughtException')[1];

      uncaughtHandler(error);

      expect(Utils.log).toHaveBeenCalledWith('error', 'Uncaught exception:', 'Uncaught error');
      expect(daemon.stop).toHaveBeenCalled();
    });

    test('should handle uncaught exceptions with debug mode', () => {
      const daemon = new Daemon();
      daemon.stop = jest.fn();
      config.isDebugMode = jest.fn().mockReturnValue(true);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Uncaught error');
      const uncaughtHandler = mockProcessOn.mock.calls.find(call => call[0] === 'uncaughtException')[1];

      uncaughtHandler(error);

      expect(consoleSpy).toHaveBeenCalledWith('Full error details:', error);

      consoleSpy.mockRestore();
    });
  });

  describe('getStatus', () => {
    test('should return correct status information', () => {
      daemon.isShuttingDown = false;
      mockScheduler.isSchedulerRunning.mockReturnValue(true);
      config.isScheduleEnabled.mockReturnValue(true);
      config.getScheduleCron.mockReturnValue('0 */12 * * *');

      const status = daemon.getStatus();

      expect(status).toEqual({
        isRunning: true,
        isShuttingDown: false,
        schedulerRunning: true,
        startTime: expect.any(Date),
        scheduleEnabled: true,
        cronSchedule: '0 */12 * * *'
      });
    });

    test('should reflect shutdown state', () => {
      daemon.isShuttingDown = true;
      mockScheduler.isSchedulerRunning.mockReturnValue(false);

      const status = daemon.getStatus();

      expect(status.isShuttingDown).toBe(true);
      expect(status.schedulerRunning).toBe(false);
    });
  });
});
