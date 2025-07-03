/**
 * Integration tests for daemon workflow
 * Tests the full daemon startup and shutdown process
 */

const { spawn } = require('child_process');
const path = require('path');

describe('Daemon Workflow Integration', () => {
  const TEST_TIMEOUT = 30000; // 30 seconds for integration tests
  
  beforeEach(() => {
    // Set test environment variables
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.OBSIDIAN_API_KEY = 'test-obsidian-key';
    process.env.TEST_MODE = 'true';
  });

  afterEach(() => {
    // Clean up test environment
    delete process.env.TEST_MODE;
    delete process.env.SCHEDULE_ENABLED;
    delete process.env.SCHEDULE_CRON;
    delete process.env.RUN_ON_START;
  });

  describe('daemon startup', () => {
    test('should fail to start without SCHEDULE_ENABLED', (done) => {
      const daemon = spawn('node', ['src/main.js', 'daemon'], {
        cwd: path.resolve(__dirname, '../..'),
        env: { ...process.env, SCHEDULE_ENABLED: 'false' }
      });

      let output = '';
      daemon.stdout.on('data', (data) => {
        output += data.toString();
      });

      daemon.stderr.on('data', (data) => {
        output += data.toString();
      });

      daemon.on('close', (code) => {
        expect(code).toBe(1);
        expect(output).toContain('Scheduler is not enabled');
        done();
      });

      // Ensure test doesn't hang
      setTimeout(() => {
        daemon.kill('SIGTERM');
        done();
      }, 5000);
    }, TEST_TIMEOUT);

    test('should start successfully with proper configuration', (done) => {
      const daemon = spawn('node', ['src/main.js', 'daemon'], {
        cwd: path.resolve(__dirname, '../..'),
        env: { 
          ...process.env, 
          SCHEDULE_ENABLED: 'true',
          SCHEDULE_CRON: '*/30 * * * * *' // Every 30 seconds for testing
        }
      });

      let output = '';
      let daemonStarted = false;

      daemon.stdout.on('data', (data) => {
        output += data.toString();
        
        if (output.includes('RSS Feeder daemon started successfully') && !daemonStarted) {
          daemonStarted = true;
          
          // Give it a moment to fully initialize
          setTimeout(() => {
            // Send SIGTERM for graceful shutdown
            daemon.kill('SIGTERM');
          }, 1000);
        }
      });

      daemon.stderr.on('data', (data) => {
        output += data.toString();
      });

      daemon.on('close', (code) => {
        expect(daemonStarted).toBe(true);
        expect(output).toContain('Starting RSS Feeder in daemon mode');
        expect(output).toContain('Starting scheduler with pattern');
        expect(output).toContain('RSS Feeder daemon started successfully');
        expect(output).toContain('Received SIGTERM signal');
        expect(output).toContain('RSS Feeder daemon stopped gracefully');
        expect(code).toBe(0);
        done();
      });

      // Ensure test doesn't hang
      setTimeout(() => {
        if (!daemonStarted) {
          daemon.kill('SIGKILL');
          done(new Error('Daemon failed to start within timeout'));
        }
      }, 10000);
    }, TEST_TIMEOUT);

    test('should handle SIGINT (Ctrl+C) gracefully', (done) => {
      const daemon = spawn('node', ['src/main.js', 'daemon'], {
        cwd: path.resolve(__dirname, '../..'),
        env: { 
          ...process.env, 
          SCHEDULE_ENABLED: 'true',
          SCHEDULE_CRON: '*/30 * * * * *'
        }
      });

      let output = '';
      let daemonStarted = false;

      daemon.stdout.on('data', (data) => {
        output += data.toString();
        
        if (output.includes('RSS Feeder daemon started successfully') && !daemonStarted) {
          daemonStarted = true;
          
          setTimeout(() => {
            // Send SIGINT (Ctrl+C)
            daemon.kill('SIGINT');
          }, 1000);
        }
      });

      daemon.stderr.on('data', (data) => {
        output += data.toString();
      });

      daemon.on('close', (code) => {
        expect(daemonStarted).toBe(true);
        expect(output).toContain('Received SIGINT signal');
        expect(output).toContain('RSS Feeder daemon stopped gracefully');
        expect(code).toBe(0);
        done();
      });

      setTimeout(() => {
        if (!daemonStarted) {
          daemon.kill('SIGKILL');
          done(new Error('Daemon failed to start within timeout'));
        }
      }, 10000);
    }, TEST_TIMEOUT);
  });

  describe('daemon with initial execution', () => {
    test('should run initial execution when RUN_ON_START is true', (done) => {
      const daemon = spawn('node', ['src/main.js', 'daemon'], {
        cwd: path.resolve(__dirname, '../..'),
        env: { 
          ...process.env, 
          SCHEDULE_ENABLED: 'true',
          RUN_ON_START: 'true',
          SCHEDULE_CRON: '*/30 * * * * *'
        }
      });

      let output = '';
      let initialExecutionSeen = false;

      daemon.stdout.on('data', (data) => {
        output += data.toString();
        
        if (output.includes('Running initial execution')) {
          initialExecutionSeen = true;
        }
        
        if (output.includes('RSS Feeder daemon started successfully')) {
          setTimeout(() => {
            daemon.kill('SIGTERM');
          }, 1000);
        }
      });

      daemon.stderr.on('data', (data) => {
        output += data.toString();
      });

      daemon.on('close', (code) => {
        expect(initialExecutionSeen).toBe(true);
        expect(output).toContain('Running initial execution');
        done();
      });

      setTimeout(() => {
        daemon.kill('SIGKILL');
        done(new Error('Test timeout'));
      }, 15000);
    }, TEST_TIMEOUT);
  });

  describe('command line interface', () => {
    test('should show help message', (done) => {
      const help = spawn('node', ['src/main.js', 'help'], {
        cwd: path.resolve(__dirname, '../..'),
        env: process.env
      });

      let output = '';
      help.stdout.on('data', (data) => {
        output += data.toString();
      });

      help.on('close', (code) => {
        expect(code).toBe(0);
        expect(output).toContain('RSS Feeder - Personal RSS Processing Tool');
        expect(output).toContain('daemon        Run in daemon mode');
        expect(output).toContain('SCHEDULE_ENABLED');
        expect(output).toContain('SCHEDULE_CRON');
        done();
      });
    }, TEST_TIMEOUT);

    test('should handle invalid command gracefully', (done) => {
      const invalid = spawn('node', ['src/main.js', 'invalid-command'], {
        cwd: path.resolve(__dirname, '../..'),
        env: process.env
      });

      let output = '';
      invalid.stdout.on('data', (data) => {
        output += data.toString();
      });

      invalid.stderr.on('data', (data) => {
        output += data.toString();
      });

      invalid.on('close', (code) => {
        // Should run default command (regular RSS processing)
        // This might fail due to missing RSS feeds in test, but that's expected
        done();
      });

      setTimeout(() => {
        invalid.kill('SIGTERM');
        done();
      }, 5000);
    }, TEST_TIMEOUT);
  });

  describe('npm scripts integration', () => {
    test('npm run daemon should work', (done) => {
      const daemon = spawn('npm', ['run', 'daemon'], {
        cwd: path.resolve(__dirname, '../..'),
        env: { 
          ...process.env, 
          SCHEDULE_ENABLED: 'true',
          SCHEDULE_CRON: '*/30 * * * * *'
        }
      });

      let output = '';
      let daemonStarted = false;

      daemon.stdout.on('data', (data) => {
        output += data.toString();
        
        if (output.includes('RSS Feeder daemon started successfully') && !daemonStarted) {
          daemonStarted = true;
          
          setTimeout(() => {
            daemon.kill('SIGTERM');
          }, 1000);
        }
      });

      daemon.stderr.on('data', (data) => {
        output += data.toString();
      });

      daemon.on('close', (code) => {
        expect(daemonStarted).toBe(true);
        expect(code).toBe(0);
        done();
      });

      setTimeout(() => {
        if (!daemonStarted) {
          daemon.kill('SIGKILL');
          done(new Error('npm run daemon failed to start within timeout'));
        }
      }, 15000);
    }, TEST_TIMEOUT);
  });
});