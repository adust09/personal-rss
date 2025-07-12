/**
 * Unit tests for Config class scheduler-related methods
 */

describe('Config - Scheduler Methods', () => {
  let _config;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear module cache to get fresh config instance
    jest.resetModules();

    // Set required environment variables for config to load
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.OBSIDIAN_API_KEY = 'test-key';

    // Load fresh config instance
    _config = require('../../src/config');
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('isScheduleEnabled', () => {
    test('should return true when SCHEDULE_ENABLED is "true"', () => {
      testUtils.withEnv({ SCHEDULE_ENABLED: 'true' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.isScheduleEnabled()).toBe(true);
      });
    });

    test('should return true when SCHEDULE_ENABLED is not set (default behavior)', () => {
      testUtils.withEnv({}, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.isScheduleEnabled()).toBe(true);
      });
    });

    test('should return false when SCHEDULE_ENABLED is "false"', () => {
      testUtils.withEnv({ SCHEDULE_ENABLED: 'false' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.isScheduleEnabled()).toBe(false);
      });
    });

    test('should return true when SCHEDULE_ENABLED is any other value (not "false")', () => {
      testUtils.withEnv({ SCHEDULE_ENABLED: 'maybe' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.isScheduleEnabled()).toBe(true);
      });
    });
  });

  describe('getScheduleCron', () => {
    test('should return custom cron schedule when SCHEDULE_CRON is set', () => {
      testUtils.withEnv({ SCHEDULE_CRON: '0 */6 * * *' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.getScheduleCron()).toBe('0 */6 * * *');
      });
    });

    test('should return default 12-hour schedule when SCHEDULE_CRON is not set', () => {
      testUtils.withEnv({}, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.getScheduleCron()).toBe('0 */12 * * *');
      });
    });

    test('should handle empty SCHEDULE_CRON value', () => {
      testUtils.withEnv({ SCHEDULE_CRON: '' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.getScheduleCron()).toBe('0 */12 * * *');
      });
    });
  });

  describe('getScheduleTimezone', () => {
    test('should return SCHEDULE_TIMEZONE when set', () => {
      testUtils.withEnv({ SCHEDULE_TIMEZONE: 'America/New_York' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.getScheduleTimezone()).toBe('America/New_York');
      });
    });

    test('should return TIMEZONE when SCHEDULE_TIMEZONE is not set', () => {
      testUtils.withEnv({ TIMEZONE: 'Europe/London' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.getScheduleTimezone()).toBe('Europe/London');
      });
    });

    test('should return default timezone when neither is set', () => {
      testUtils.withEnv({}, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.getScheduleTimezone()).toBe('Asia/Tokyo');
      });
    });

    test('should prioritize SCHEDULE_TIMEZONE over TIMEZONE', () => {
      testUtils.withEnv(
        {
          TIMEZONE: 'Europe/London',
          SCHEDULE_TIMEZONE: 'America/New_York'
        },
        () => {
          jest.resetModules();
          const config = require('../../src/config');
          expect(config.getScheduleTimezone()).toBe('America/New_York');
        }
      );
    });
  });

  describe('isDaemonMode', () => {
    test('should return true when DAEMON_MODE is "true"', () => {
      testUtils.withEnv({ DAEMON_MODE: 'true' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.isDaemonMode()).toBe(true);
      });
    });

    test('should return false when DAEMON_MODE is not set', () => {
      testUtils.withEnv({}, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.isDaemonMode()).toBe(false);
      });
    });

    test('should return false when DAEMON_MODE is "false"', () => {
      testUtils.withEnv({ DAEMON_MODE: 'false' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.isDaemonMode()).toBe(false);
      });
    });
  });

  describe('getRunOnStart', () => {
    test('should return true when RUN_ON_START is "true"', () => {
      testUtils.withEnv({ RUN_ON_START: 'true' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.getRunOnStart()).toBe(true);
      });
    });

    test('should return false when RUN_ON_START is not set', () => {
      testUtils.withEnv({}, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.getRunOnStart()).toBe(false);
      });
    });

    test('should return false when RUN_ON_START is "false"', () => {
      testUtils.withEnv({ RUN_ON_START: 'false' }, () => {
        jest.resetModules();
        const config = require('../../src/config');
        expect(config.getRunOnStart()).toBe(false);
      });
    });
  });

  describe('integration with existing config methods', () => {
    test('should not affect existing functionality', () => {
      testUtils.withEnv(
        {
          GEMINI_API_KEY: 'test-gemini',
          OBSIDIAN_API_KEY: 'test-obsidian',
          TIMEZONE: 'Asia/Tokyo',
          DEBUG: 'true'
        },
        () => {
          jest.resetModules();
          const config = require('../../src/config');

          expect(config.getGeminiApiKey()).toBe('test-gemini');
          expect(config.getObsidianApiKey()).toBe('test-obsidian');
          expect(config.getTimezone()).toBe('Asia/Tokyo');
          expect(config.isDebugMode()).toBe(true);
        }
      );
    });

    test('should work alongside scheduler configuration', () => {
      testUtils.withEnv(
        {
          GEMINI_API_KEY: 'test-gemini',
          OBSIDIAN_API_KEY: 'test-obsidian',
          SCHEDULE_ENABLED: 'true',
          SCHEDULE_CRON: '0 */8 * * *',
          SCHEDULE_TIMEZONE: 'UTC'
        },
        () => {
          jest.resetModules();
          const config = require('../../src/config');

          expect(config.getGeminiApiKey()).toBe('test-gemini');
          expect(config.isScheduleEnabled()).toBe(true);
          expect(config.getScheduleCron()).toBe('0 */8 * * *');
          expect(config.getScheduleTimezone()).toBe('UTC');
        }
      );
    });
  });

  describe('Tag System Methods', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    describe('getTags', () => {
      test('should return tags configuration', () => {
        testUtils.withEnv(
          {
            GEMINI_API_KEY: 'test-gemini',
            OBSIDIAN_API_KEY: 'test-obsidian'
          },
          () => {
            const config = require('../../src/config');
            const tags = config.getTags();

            expect(tags).toHaveProperty('tags');
            expect(tags).toHaveProperty('config');
            expect(tags.config).toHaveProperty('maxTagsPerArticle');
            expect(tags.config).toHaveProperty('defaultTag');
          }
        );
      });

      test('should have valid tag structure', () => {
        testUtils.withEnv(
          {
            GEMINI_API_KEY: 'test-gemini',
            OBSIDIAN_API_KEY: 'test-obsidian'
          },
          () => {
            const config = require('../../src/config');
            const tags = config.getTags();

            expect(typeof tags.tags).toBe('object');
            Object.entries(tags.tags).forEach(([tagName, tagData]) => {
              expect(typeof tagName).toBe('string');
              expect(tagData).toHaveProperty('display');
              expect(tagData).toHaveProperty('description');
              expect(Array.isArray(tagData.subtags)).toBe(true);
            });
          }
        );
      });
    });

    describe('getAvailableParentTags', () => {
      test('should return array of parent tag names', () => {
        testUtils.withEnv(
          {
            GEMINI_API_KEY: 'test-gemini',
            OBSIDIAN_API_KEY: 'test-obsidian'
          },
          () => {
            const config = require('../../src/config');
            const parentTags = config.getAvailableParentTags();

            expect(Array.isArray(parentTags)).toBe(true);
            expect(parentTags.length).toBeGreaterThan(0);
            expect(parentTags).toContain('ai');
            expect(parentTags).toContain('tech');
            expect(parentTags).toContain('business');
          }
        );
      });
    });

    describe('getSubtags', () => {
      test('should return subtags for ai parent tag', () => {
        testUtils.withEnv(
          {
            GEMINI_API_KEY: 'test-gemini',
            OBSIDIAN_API_KEY: 'test-obsidian'
          },
          () => {
            const config = require('../../src/config');
            const subtags = config.getSubtags('ai');

            expect(Array.isArray(subtags)).toBe(true);
            expect(subtags).toContain('llm');
            expect(subtags).toContain('rag');
            expect(subtags).toContain('ml');
          }
        );
      });

      test('should return empty array for non-existent parent tag', () => {
        testUtils.withEnv(
          {
            GEMINI_API_KEY: 'test-gemini',
            OBSIDIAN_API_KEY: 'test-obsidian'
          },
          () => {
            const config = require('../../src/config');
            const subtags = config.getSubtags('nonexistent');

            expect(Array.isArray(subtags)).toBe(true);
            expect(subtags.length).toBe(0);
          }
        );
      });
    });

    describe('getFormattedTagList', () => {
      test('should return formatted string of tags', () => {
        testUtils.withEnv(
          {
            GEMINI_API_KEY: 'test-gemini',
            OBSIDIAN_API_KEY: 'test-obsidian'
          },
          () => {
            const config = require('../../src/config');
            const formatted = config.getFormattedTagList();

            expect(typeof formatted).toBe('string');
            expect(formatted).toContain('ai');
            expect(formatted).toContain('llm');
            expect(formatted).toContain('tech');
          }
        );
      });
    });

    describe('getTagConfig', () => {
      test('should return tag configuration with defaults', () => {
        testUtils.withEnv(
          {
            GEMINI_API_KEY: 'test-gemini',
            OBSIDIAN_API_KEY: 'test-obsidian'
          },
          () => {
            const config = require('../../src/config');
            const tagConfig = config.getTagConfig();

            expect(tagConfig).toHaveProperty('maxTagsPerArticle');
            expect(tagConfig).toHaveProperty('defaultTag');
            expect(tagConfig).toHaveProperty('allowMultipleParentTags');
            expect(typeof tagConfig.maxTagsPerArticle).toBe('number');
            expect(typeof tagConfig.defaultTag).toBe('string');
            expect(typeof tagConfig.allowMultipleParentTags).toBe('boolean');
          }
        );
      });
    });
  });
});
