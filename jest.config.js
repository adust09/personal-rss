module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/test/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/main.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};