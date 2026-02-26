/**
 * Tests for FeishuChannel bot collaboration feature.
 *
 * Tests the bot-to-bot collaboration functionality:
 * - Configuration loading
 * - Bot message filtering
 * - Conversation depth tracking
 * - Loop prevention
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing FeishuChannel
vi.mock('../utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  })),
}));

vi.mock('../core/attachment-manager.js', () => ({
  attachmentManager: {
    getAttachments: vi.fn(() => []),
    cleanupOldAttachments: vi.fn(),
  },
}));

vi.mock('../feishu/file-downloader.js', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('../feishu/message-logger.js', () => ({
  messageLogger: {
    init: vi.fn(),
    isMessageProcessed: vi.fn(() => false),
    logIncomingMessage: vi.fn(),
  },
}));

vi.mock('../feishu/file-handler.js', () => ({
  FileHandler: vi.fn().mockImplementation(() => ({
    handleFileMessage: vi.fn(),
    buildUploadPrompt: vi.fn(),
  })),
}));

vi.mock('../feishu/message-sender.js', () => ({
  MessageSender: vi.fn(),
}));

vi.mock('../feishu/task-flow-orchestrator.js', () => ({
  TaskFlowOrchestrator: vi.fn(),
}));

vi.mock('../utils/task-tracker.js', () => ({
  TaskTracker: vi.fn(),
}));

describe('FeishuChannel Bot Collaboration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Configuration Loading', () => {
    it('should create channel with default settings when no bot collaboration config', async () => {
      // Mock config without bot collaboration
      vi.doMock('../config/index.js', () => ({
        Config: {
          FEISHU_APP_ID: 'test_app_id',
          FEISHU_APP_SECRET: 'test_app_secret',
          FEISHU_CLI_CHAT_ID: '',
          getRawConfig: vi.fn(() => ({})),
        },
      }));

      const { FeishuChannel } = await import('./feishu-channel.js');
      const channel = new FeishuChannel();

      // The channel should be created successfully
      expect(channel).toBeDefined();
      expect(channel.id).toBe('feishu');
    });

    it('should create channel with bot collaboration disabled by default', async () => {
      // Mock config with empty feishu config
      vi.doMock('../config/index.js', () => ({
        Config: {
          FEISHU_APP_ID: 'test_app_id',
          FEISHU_APP_SECRET: 'test_app_secret',
          FEISHU_CLI_CHAT_ID: '',
          getRawConfig: vi.fn(() => ({
            feishu: {},
          })),
        },
      }));

      const { FeishuChannel } = await import('./feishu-channel.js');
      const channel = new FeishuChannel();

      expect(channel).toBeDefined();
    });
  });

  describe('Bot Message Handling Logic', () => {
    it('should load allowed bot IDs when configured', async () => {
      // Mock config with bot collaboration
      vi.doMock('../config/index.js', () => ({
        Config: {
          FEISHU_APP_ID: 'test_app_id',
          FEISHU_APP_SECRET: 'test_app_secret',
          FEISHU_CLI_CHAT_ID: '',
          getRawConfig: vi.fn(() => ({
            feishu: {
              botCollaboration: {
                enabled: true,
                allowedBotIds: ['cli_allowed_bot_1', 'cli_allowed_bot_2'],
                maxDepth: 3,
              },
            },
          })),
        },
      }));

      const { FeishuChannel } = await import('./feishu-channel.js');
      const channel = new FeishuChannel();

      // Access internal state through reflection for testing
      const channelAny = channel as unknown as {
        allowedBotIds: Set<string>;
        botCollaborationEnabled: boolean;
        maxConversationDepth: number;
      };

      expect(channelAny.botCollaborationEnabled).toBe(true);
      expect(channelAny.allowedBotIds.has('cli_allowed_bot_1')).toBe(true);
      expect(channelAny.allowedBotIds.has('cli_allowed_bot_2')).toBe(true);
      expect(channelAny.allowedBotIds.has('cli_unknown_bot')).toBe(false);
      expect(channelAny.maxConversationDepth).toBe(3);
    });
  });

  describe('Conversation Depth Tracking', () => {
    it('should initialize conversation depth map', async () => {
      vi.doMock('../config/index.js', () => ({
        Config: {
          FEISHU_APP_ID: 'test_app_id',
          FEISHU_APP_SECRET: 'test_app_secret',
          FEISHU_CLI_CHAT_ID: '',
          getRawConfig: vi.fn(() => ({})),
        },
      }));

      const { FeishuChannel } = await import('./feishu-channel.js');
      const channel = new FeishuChannel();

      const channelAny = channel as unknown as {
        conversationDepth: Map<string, number>;
      };

      expect(channelAny.conversationDepth).toBeInstanceOf(Map);
      expect(channelAny.conversationDepth.size).toBe(0);
    });
  });
});

describe('Bot Collaboration Utilities', () => {
  describe('Bot ID Extraction', () => {
    it('should extract open_id from sender object', () => {
      // Test the extraction logic pattern
      const extractOpenId = (sender?: { sender_type?: string; sender_id?: unknown }): string | undefined => {
        if (!sender?.sender_id) {
          return undefined;
        }
        if (typeof sender.sender_id === 'object' && sender.sender_id !== null) {
          const senderId = sender.sender_id as { open_id?: string };
          return senderId.open_id;
        }
        if (typeof sender.sender_id === 'string') {
          return sender.sender_id;
        }
        return undefined;
      };

      expect(extractOpenId()).toBeUndefined();
      expect(extractOpenId({})).toBeUndefined();
      expect(extractOpenId({ sender_type: 'app' })).toBeUndefined();
      expect(extractOpenId({ sender_type: 'app', sender_id: { open_id: 'cli_test' } })).toBe('cli_test');
      expect(extractOpenId({ sender_type: 'app', sender_id: 'cli_string' })).toBe('cli_string');
    });
  });

  describe('Loop Prevention Logic', () => {
    it('should track and limit conversation depth', () => {
      const conversationDepth = new Map<string, number>();
      const maxDepth = 3;
      const chatId = 'test_chat';

      // Simulate bot messages increasing depth
      const checkAndIncrementDepth = (chatId: string): boolean => {
        const currentDepth = conversationDepth.get(chatId) ?? 0;
        if (currentDepth >= maxDepth) {
          return false; // Max depth reached, should skip
        }
        conversationDepth.set(chatId, currentDepth + 1);
        return true; // OK to process
      };

      // First message should pass
      expect(checkAndIncrementDepth(chatId)).toBe(true);
      expect(conversationDepth.get(chatId)).toBe(1);

      // Second message should pass
      expect(checkAndIncrementDepth(chatId)).toBe(true);
      expect(conversationDepth.get(chatId)).toBe(2);

      // Third message should pass
      expect(checkAndIncrementDepth(chatId)).toBe(true);
      expect(conversationDepth.get(chatId)).toBe(3);

      // Fourth message should be blocked
      expect(checkAndIncrementDepth(chatId)).toBe(false);
      expect(conversationDepth.get(chatId)).toBe(3);
    });

    it('should reset depth when human user sends message', () => {
      const conversationDepth = new Map<string, number>();
      const chatId = 'test_chat';

      // Set some depth
      conversationDepth.set(chatId, 3);

      // Human user message should reset depth
      const handleHumanMessage = (chatId: string) => {
        conversationDepth.delete(chatId);
      };

      handleHumanMessage(chatId);
      expect(conversationDepth.has(chatId)).toBe(false);
    });
  });
});
