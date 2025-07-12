/**
 * Jest setup file for RSS Feeder tests
 * Configures global test environment and utilities
 */

// Mock environment variables for testing
if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
}
if (!process.env.OBSIDIAN_API_KEY) {
  process.env.OBSIDIAN_API_KEY = 'test-obsidian-key';
}
if (!process.env.OBSIDIAN_API_URL) {
  process.env.OBSIDIAN_API_URL = 'http://localhost:27124/';
}
if (!process.env.DEBUG) {
  process.env.DEBUG = 'false';
}
if (!process.env.TIMEZONE) {
  process.env.TIMEZONE = 'Asia/Tokyo';
}

// Suppress console output during tests unless DEBUG is set
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: process.env.TEST_DEBUG ? originalConsole.log : jest.fn(),
  warn: process.env.TEST_DEBUG ? originalConsole.warn : jest.fn(),
  error: originalConsole.error, // Always show errors
  info: process.env.TEST_DEBUG ? originalConsole.info : jest.fn()
};

// Global test utilities
global.testUtils = {
  // Mock RSS feeder for testing
  createMockRSSFeeder: () => ({
    run: jest.fn().mockResolvedValue(undefined),
    validateConfiguration: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    testRun: jest.fn().mockResolvedValue(undefined)
  }),

  // Sleep utility for integration tests
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),

  // Environment variable helper
  withEnv: (envVars, testFn) => {
    const originalEnv = { ...process.env };

    Object.assign(process.env, envVars);

    try {
      return testFn();
    } finally {
      process.env = originalEnv;
    }
  }
};

// Clean up modules between tests to ensure fresh state
afterEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});
