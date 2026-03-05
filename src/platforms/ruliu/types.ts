/**
 * Ruliu Platform Types.
 *
 * Type definitions for the Ruliu platform adapter implementation.
 * Follows the same pattern as Feishu platform adapter.
 *
 * @see IPlatformAdapter - Platform-agnostic adapter interface
 */

import type { Logger } from 'pino';
import type { IAttachmentManager } from '../../channels/adapters/types.js';

/**
 * Ruliu API Client type.
 * Replace with actual Ruliu SDK client type when available.
 */
export type RuliuClient = unknown;

/**
 * Ruliu Message Sender Configuration.
 */
export interface RuliuMessageSenderConfig {
  /** Ruliu API client */
  client: RuliuClient;
  /** Logger instance */
  logger: Logger;
}

/**
 * File download function type for Ruliu.
 */
export type RuliuFileDownloadFunction = (
  fileKey: string,
  messageType: string,
  fileName?: string,
  messageId?: string
) => Promise<{ success: boolean; filePath?: string }>;

/**
 * Ruliu File Handler Configuration.
 */
export interface RuliuFileHandlerConfig {
  /** Attachment manager for storing file metadata */
  attachmentManager: IAttachmentManager;
  /** File download function */
  downloadFile: RuliuFileDownloadFunction;
}

/**
 * Ruliu Platform Adapter Configuration.
 */
export interface RuliuPlatformAdapterConfig {
  /** Ruliu App ID or API key */
  appId?: string;
  /** Ruliu App Secret or API secret */
  appSecret?: string;
  /** Ruliu API base URL (optional, for custom endpoints) */
  apiBaseUrl?: string;
  /** Ruliu client instance (optional, will be created if not provided) */
  client?: RuliuClient;
  /** Logger instance */
  logger: Logger;
  /** Attachment manager for file handling */
  attachmentManager: RuliuFileHandlerConfig['attachmentManager'];
  /** File download function */
  downloadFile: RuliuFileHandlerConfig['downloadFile'];
}

/**
 * Ruliu message types.
 */
export type RuliuMessageType = 'text' | 'image' | 'file' | 'media' | 'interactive';

/**
 * Ruliu message content structure.
 */
export interface RuliuMessageContent {
  /** Message type */
  msgType: RuliuMessageType;
  /** Message content (type-specific) */
  content: string | Record<string, unknown>;
  /** Thread ID for threaded replies (optional) */
  threadId?: string;
}

/**
 * Ruliu incoming message event.
 */
export interface RuliuMessageEvent {
  /** Unique message ID */
  messageId: string;
  /** Chat/conversation ID */
  chatId: string;
  /** Sender ID */
  senderId: string;
  /** Sender type (user, bot, etc.) */
  senderType: 'user' | 'bot' | 'system';
  /** Message type */
  messageType: RuliuMessageType;
  /** Raw message content */
  content: string;
  /** Timestamp */
  timestamp: number;
  /** Thread ID if part of a thread */
  threadId?: string;
  /** Parent message ID for replies */
  parentId?: string;
}

/**
 * Ruliu reaction event.
 */
export interface RuliuReactionEvent {
  /** Message ID that was reacted to */
  messageId: string;
  /** Chat ID */
  chatId: string;
  /** User who reacted */
  userId: string;
  /** Emoji identifier */
  emoji: string;
  /** Action type */
  action: 'add' | 'remove';
}

/**
 * Ruliu Webhook Configuration.
 */
export interface RuliuWebhookConfig {
  /** Webhook verification token */
  verifyToken?: string;
  /** Webhook URL path */
  path?: string;
  /** Whether to verify webhook signatures */
  verifySignature?: boolean;
}