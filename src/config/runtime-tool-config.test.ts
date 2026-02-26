/**
 * Tests for runtime tool configuration (src/config/runtime-tool-config.ts)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock Config module before importing the module under test
const testWorkspace = '/tmp/test-runtime-tools-isolated';
const configPath = path.join(testWorkspace, 'runtime-tool-config.json');

vi.mock('./index.js', () => ({
  Config: {
    getWorkspaceDir: () => testWorkspace,
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import after mocks are set up
import { RuntimeToolConfigManager } from './runtime-tool-config.js';

describe('RuntimeToolConfigManager', () => {
  let manager: RuntimeToolConfigManager;

  const cleanup = () => {
    // Delete config file
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  };

  beforeEach(() => {
    // Ensure test directory exists
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Get singleton and reset its state
    manager = RuntimeToolConfigManager.getInstance();
    manager.reset();
  });

  afterEach(() => {
    cleanup();
  });

  describe('initialization', () => {
    it('should create default config when no file exists', () => {
      const config = manager.getFullConfig();
      expect(config.global.disabled).toEqual([]);
      expect(config.global.enabled).toEqual([]);
      expect(config.chats).toEqual({});
    });

    it('should load existing config file', () => {
      // Create a config file first
      const existingConfig = {
        global: {
          disabled: ['WebSearch'],
          enabled: [],
          disabledReasons: { WebSearch: 'Test reason' },
          disabledAt: { WebSearch: '2026-01-01T00:00:00.000Z' },
        },
        chats: {},
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      fs.writeFileSync(configPath, JSON.stringify(existingConfig));

      // Reset and reload
      RuntimeToolConfigManager.resetInstance();
      manager = RuntimeToolConfigManager.getInstance();

      const config = manager.getFullConfig();
      expect(config.global.disabled).toContain('WebSearch');
    });
  });

  describe('disableTool', () => {
    it('should disable a tool globally', () => {
      manager.disableTool('WebSearch', 'Weekly quota exceeded');

      const config = manager.getConfig();
      expect(config.disabled).toContain('WebSearch');
      expect(config.disabledReasons['WebSearch']).toBe('Weekly quota exceeded');
      expect(config.disabledAt['WebSearch']).toBeDefined();
    });

    it('should disable a tool for specific chat', () => {
      manager.disableTool('Bash', 'User requested', 'oc_123');

      const globalConfig = manager.getConfig();
      expect(globalConfig.disabled).not.toContain('Bash');

      const chatConfig = manager.getConfig('oc_123');
      expect(chatConfig.disabled).toContain('Bash');
      expect(chatConfig.disabledReasons['Bash']).toBe('User requested');
    });

    it('should not duplicate disabled tools', () => {
      manager.disableTool('WebSearch', 'Reason 1');
      manager.disableTool('WebSearch', 'Reason 2');

      const config = manager.getConfig();
      expect(config.disabled.filter(t => t === 'WebSearch')).toHaveLength(1);
      // Latest reason should be kept
      expect(config.disabledReasons['WebSearch']).toBe('Reason 2');
    });
  });

  describe('enableTool', () => {
    it('should enable a previously disabled tool', () => {
      manager.disableTool('WebSearch', 'Test');
      expect(manager.isToolAvailable('WebSearch')).toBe(false);

      manager.enableTool('WebSearch');
      expect(manager.isToolAvailable('WebSearch')).toBe(true);
    });

    it('should remove disable info when enabling', () => {
      manager.disableTool('WebSearch', 'Test reason');
      manager.enableTool('WebSearch');

      const config = manager.getConfig();
      expect(config.disabledReasons['WebSearch']).toBeUndefined();
      expect(config.disabledAt['WebSearch']).toBeUndefined();
    });

    it('should optionally add to whitelist', () => {
      manager.enableTool('WebSearch', undefined, true);

      const config = manager.getConfig();
      expect(config.enabled).toContain('WebSearch');
    });
  });

  describe('isToolAvailable', () => {
    it('should return true for available tools', () => {
      expect(manager.isToolAvailable('Read')).toBe(true);
      expect(manager.isToolAvailable('Write')).toBe(true);
    });

    it('should return false for disabled tools', () => {
      manager.disableTool('WebSearch', 'Test');
      expect(manager.isToolAvailable('WebSearch')).toBe(false);
    });

    it('should respect whitelist over blacklist', () => {
      manager.disableTool('WebSearch', 'Global disable');
      manager.enableTool('WebSearch', 'oc_123', true);

      // Global: disabled
      expect(manager.isToolAvailable('WebSearch')).toBe(false);
      // Chat-specific: enabled (whitelist)
      expect(manager.isToolAvailable('WebSearch', 'oc_123')).toBe(true);
    });

    it('should merge global and chat-specific blacklists', () => {
      manager.disableTool('WebSearch', 'Global');
      manager.disableTool('Bash', 'Chat', 'oc_123');

      const chatConfig = manager.getConfig('oc_123');
      expect(chatConfig.disabled).toContain('WebSearch');
      expect(chatConfig.disabled).toContain('Bash');
    });
  });

  describe('getDisabledTools', () => {
    it('should return empty array when no tools disabled', () => {
      expect(manager.getDisabledTools()).toEqual([]);
    });

    it('should return disabled tools', () => {
      manager.disableTool('WebSearch', 'Test 1');
      manager.disableTool('webReader', 'Test 2');

      const disabled = manager.getDisabledTools();
      expect(disabled).toContain('WebSearch');
      expect(disabled).toContain('webReader');
    });
  });

  describe('getToolDisableInfo', () => {
    it('should return null for non-disabled tool', () => {
      expect(manager.getToolDisableInfo('Read')).toBeNull();
    });

    it('should return disable info for disabled tool', () => {
      manager.disableTool('WebSearch', 'Quota exceeded');

      const info = manager.getToolDisableInfo('WebSearch');
      expect(info).not.toBeNull();
      expect(info?.reason).toBe('Quota exceeded');
      expect(info?.disabledAt).toBeDefined();
    });
  });

  describe('clearChatConfig', () => {
    it('should remove chat-specific configuration', () => {
      manager.disableTool('Bash', 'Test', 'oc_123');
      expect(manager.getDisabledTools('oc_123')).toContain('Bash');

      manager.clearChatConfig('oc_123');
      expect(manager.getDisabledTools('oc_123')).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('should persist config to file', () => {
      manager.disableTool('WebSearch', 'Test');

      // Check file was created
      expect(fs.existsSync(configPath)).toBe(true);

      // Verify content
      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(content.global.disabled).toContain('WebSearch');
    });

    it('should persist across instances', () => {
      manager.disableTool('WebSearch', 'Test');

      // Reset singleton but keep config file
      RuntimeToolConfigManager.resetInstance();
      manager = RuntimeToolConfigManager.getInstance();

      expect(manager.isToolAvailable('WebSearch')).toBe(false);
    });
  });
});
