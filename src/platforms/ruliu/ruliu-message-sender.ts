/**
 * Ruliu Message Sender Implementation.
 *
 * Implements IMessageSender interface for Ruliu (百度如流) platform.
 * Handles text and markdown messages via Ruliu API.
 *
 * @see https://qy.baidu.com/doc/index.html#/inner_serverapi/robot
 */

import type { Logger } from 'pino';
import type { IMessageSender } from '../../channels/adapters/types.js';
import { handleError, ErrorCategory } from '../../utils/error-handler.js';

/**
 * Ruliu API response structure.
 */
interface RuliuApiResponse<T = unknown> {
  errno: number;
  errmsg: string;
  data?: T;
}

/**
 * Ruliu send message response.
 */
interface RuliuSendMessageResponse {
  messageId: string;
}

/**
 * Ruliu Message Sender Configuration.
 */
export interface RuliuMessageSenderConfig {
  /** Ruliu API host (e.g., https://apiin.im.baidu.com) */
  apiHost: string;
  /** App Key */
  appKey: string;
  /** App Secret */
  appSecret: string;
  /** Logger instance */
  logger: Logger;
}

/**
 * Ruliu message body types.
 */
type RuliuMessageBodyItem =
  | { type: 'TEXT'; content: string }
  | { type: 'MD'; content: string }
  | { type: 'AT'; atall?: boolean; atuserids?: string[]; atagentids?: number[] }
  | { type: 'LINK'; href: string };

/**
 * Ruliu send message request.
 */
interface RuliuSendMessageRequest {
  /** Target chat ID */
  chatId: string;
  /** Message body */
  body: RuliuMessageBodyItem[];
  /** Parent message ID for threaded reply */
  parentId?: string;
}

/**
 * Ruliu Message Sender.
 *
 * Implements platform-agnostic IMessageSender interface for Ruliu.
 */
export class RuliuMessageSender implements IMessageSender {
  private apiHost: string;
  private appKey: string;
  private appSecret: string;
  private logger: Logger;
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  constructor(config: RuliuMessageSenderConfig) {
    this.apiHost = config.apiHost;
    this.appKey = config.appKey;
    this.appSecret = config.appSecret;
    this.logger = config.logger;
  }

  /**
   * Get access token for Ruliu API.
   * Tokens are cached and refreshed when expired.
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.apiHost}/api/robot/getAccessToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appKey: this.appKey,
          appSecret: this.appSecret,
        }),
      });

      const result = (await response.json()) as RuliuApiResponse<{ accessToken: string; expireIn: number }>;

      if (result.errno !== 0) {
        throw new Error(`Failed to get access token: ${result.errmsg}`);
      }

      this.accessToken = result.data!.accessToken;
      // Set expire time with 5 minute buffer
      this.tokenExpireTime = Date.now() + (result.data!.expireIn - 300) * 1000;

      return this.accessToken;
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to get Ruliu access token');
      throw error;
    }
  }

  /**
   * Make an API request to Ruliu.
   */
  private async apiRequest<T>(
    endpoint: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.apiHost}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const result = (await response.json()) as RuliuApiResponse<T>;

    if (result.errno !== 0) {
      throw new Error(`Ruliu API error: ${result.errmsg} (errno: ${result.errno})`);
    }

    return result.data as T;
  }

  /**
   * Send a text message.
   */
  async sendText(chatId: string, text: string, threadId?: string): Promise<void> {
    try {
      const result = await this.apiRequest<RuliuSendMessageResponse>(
        '/api/robot/sendMessage',
        {
          chatId,
          body: [{ type: 'TEXT', content: text }],
          parentId: threadId,
        }
      );

      const preview = text.length > 100 ? `${text.substring(0, 100)}...` : text;
      this.logger.debug(
        { chatId, messageType: 'text', preview, messageId: result.messageId, threadId },
        'Message sent'
      );
    } catch (error) {
      handleError(
        error,
        { category: ErrorCategory.API, chatId, messageType: 'text' },
        { log: true, customLogger: this.logger }
      );
    }
  }

  /**
   * Send a card message (using Markdown format).
   * Ruliu doesn't have native card support, so we use Markdown instead.
   */
  async sendCard(
    chatId: string,
    card: Record<string, unknown>,
    description?: string,
    threadId?: string
  ): Promise<void> {
    try {
      // Convert card to markdown representation
      let markdown = description || 'Interactive Card';
      if (card.title) {
        markdown = `## ${card.title}\n\n${markdown}`;
      }
      if (card.content) {
        markdown += `\n\n${card.content}`;
      }

      const result = await this.apiRequest<RuliuSendMessageResponse>(
        '/api/robot/sendMessage',
        {
          chatId,
          body: [{ type: 'MD', content: markdown }],
          parentId: threadId,
        }
      );

      this.logger.debug(
        { chatId, description, threadId, messageId: result.messageId },
        'Card sent (as markdown)'
      );
    } catch (error) {
      handleError(
        error,
        { category: ErrorCategory.API, chatId, description, messageType: 'card' },
        { log: true, customLogger: this.logger }
      );
    }
  }

  /**
   * Send a file message.
   * Note: Ruliu file sending requires different API, this is a placeholder.
   */
  async sendFile(chatId: string, filePath: string, threadId?: string): Promise<void> {
    // TODO: Implement file upload and send for Ruliu
    this.logger.warn(
      { chatId, filePath, threadId },
      'File sending not yet implemented for Ruliu'
    );
  }

  /**
   * Add a reaction to a message.
   * Note: Ruliu may not support reactions via API, this is a placeholder.
   */
  async addReaction(messageId: string, emoji: string): Promise<boolean> {
    // TODO: Check if Ruliu supports reactions
    this.logger.warn(
      { messageId, emoji },
      'Reactions not yet implemented for Ruliu'
    );
    return false;
  }

  /**
   * Send a message with @mentions.
   */
  async sendWithMentions(
    chatId: string,
    text: string,
    userIds: string[],
    threadId?: string
  ): Promise<void> {
    try {
      const body: RuliuMessageBodyItem[] = [
        { type: 'AT', atuserids: userIds },
        { type: 'TEXT', content: text },
      ];

      const result = await this.apiRequest<RuliuSendMessageResponse>(
        '/api/robot/sendMessage',
        {
          chatId,
          body,
          parentId: threadId,
        }
      );

      this.logger.debug(
        { chatId, userIds, threadId, messageId: result.messageId },
        'Message with mentions sent'
      );
    } catch (error) {
      handleError(
        error,
        { category: ErrorCategory.API, chatId, messageType: 'text_with_mentions' },
        { log: true, customLogger: this.logger }
      );
    }
  }

  /**
   * Send a markdown message.
   */
  async sendMarkdown(chatId: string, markdown: string, threadId?: string): Promise<void> {
    try {
      const result = await this.apiRequest<RuliuSendMessageResponse>(
        '/api/robot/sendMessage',
        {
          chatId,
          body: [{ type: 'MD', content: markdown }],
          parentId: threadId,
        }
      );

      const preview = markdown.length > 100 ? `${markdown.substring(0, 100)}...` : markdown;
      this.logger.debug(
        { chatId, messageType: 'markdown', preview, messageId: result.messageId, threadId },
        'Markdown message sent'
      );
    } catch (error) {
      handleError(
        error,
        { category: ErrorCategory.API, chatId, messageType: 'markdown' },
        { log: true, customLogger: this.logger }
      );
    }
  }
}