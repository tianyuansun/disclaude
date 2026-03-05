/**
 * Ruliu Platform Adapter Implementation.
 *
 * Implements IPlatformAdapter interface for Ruliu (百度如流) platform.
 * Combines RuliuMessageSender and file handling into a unified adapter.
 *
 * @see https://qy.baidu.com/doc/index.html#/inner_serverapi/robot
 */

import type { Logger } from 'pino';
import type { IPlatformAdapter } from '../../channels/adapters/types.js';
import { RuliuMessageSender, type RuliuMessageSenderConfig } from './ruliu-message-sender.js';
import { RuliuCrypto, type RuliuCryptoConfig } from './ruliu-crypto.js';

/**
 * Ruliu Platform Adapter Configuration.
 */
export interface RuliuPlatformAdapterConfig {
  /** Ruliu API host (e.g., https://apiin.im.baidu.com) */
  apiHost: string;
  /** App Key */
  appKey: string;
  /** App Secret */
  appSecret: string;
  /** Encoding AES Key for message encryption (43 characters, base64) */
  encodingAESKey: string;
  /** Check Token for signature verification */
  checkToken?: string;
  /** Robot name (for @mention detection) */
  robotName?: string;
  /** Logger instance */
  logger: Logger;
  /** Attachment manager for file handling */
  attachmentManager: unknown;
  /** File download function */
  downloadFile: unknown;
}

/**
 * Ruliu Platform Adapter.
 *
 * Combines all Ruliu-specific functionality into a single adapter
 * that implements the platform-agnostic IPlatformAdapter interface.
 *
 * Features:
 * - Message sending (text, markdown, with mentions)
 * - Message encryption/decryption (AES-256-CBC)
 * - Signature verification
 */
export class RuliuPlatformAdapter implements IPlatformAdapter {
  readonly platformId = 'ruliu';
  readonly platformName = 'Ruliu (百度如流)';

  readonly messageSender: RuliuMessageSender;
  readonly crypto: RuliuCrypto;

  private logger: Logger;
  private robotName?: string;

  constructor(config: RuliuPlatformAdapterConfig) {
    this.logger = config.logger;
    this.robotName = config.robotName;

    // Create message sender
    this.messageSender = new RuliuMessageSender({
      apiHost: config.apiHost,
      appKey: config.appKey,
      appSecret: config.appSecret,
      logger: this.logger,
    });

    // Create crypto utility
    this.crypto = new RuliuCrypto({
      encodingAESKey: config.encodingAESKey,
      token: config.checkToken,
    });
  }

  /**
   * Get the robot name.
   */
  getRobotName(): string | undefined {
    return this.robotName;
  }

  /**
   * Decrypt an encrypted message from Ruliu webhook.
   *
   * @param encryptedMsg - Base64-encoded encrypted message
   * @returns Decrypted message JSON string
   */
  decryptMessage(encryptedMsg: string): string {
    return this.crypto.decrypt(encryptedMsg);
  }

  /**
   * Verify webhook signature.
   *
   * @param signature - Signature from request
   * @param timestamp - Timestamp from request
   * @param nonce - Nonce from request
   * @param encrypt - Encrypted message
   * @returns Whether signature is valid
   */
  verifySignature(signature: string, timestamp: string, nonce: string, encrypt: string): boolean {
    try {
      return this.crypto.verifySignature(signature, timestamp, nonce, encrypt);
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to verify signature');
      return false;
    }
  }

  /**
   * Check if a message mentions the robot.
   *
   * @param mentionIds - Mentioned user/agent IDs
   * @returns Whether the robot is mentioned
   */
  isRobotMentioned(mentionIds?: { userIds?: string[]; agentIds?: number[] }): boolean {
    if (!mentionIds) return false;
    
    // Check if any agent is mentioned
    if (mentionIds.agentIds && mentionIds.agentIds.length > 0) {
      return true;
    }

    // Could also check userIds against known robot user ID if available
    return false;
  }
}