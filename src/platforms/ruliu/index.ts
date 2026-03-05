/**
 * Ruliu Platform Adapter Module.
 *
 * Exports all Ruliu platform components for use by the application.
 *
 * @example
 * ```typescript
 * import { RuliuPlatformAdapter } from './platforms/ruliu';
 *
 * const adapter = new RuliuPlatformAdapter({
 *   apiHost: 'https://apiin.im.baidu.com',
 *   appKey: 'your-app-key',
 *   appSecret: 'your-app-secret',
 *   encodingAESKey: 'your-encoding-aes-key',
 *   logger,
 *   attachmentManager,
 *   downloadFile,
 * });
 * ```
 */

// Main adapter
export { RuliuPlatformAdapter, type RuliuPlatformAdapterConfig } from './ruliu-adapter.js';

// Message sender
export {
  RuliuMessageSender,
  type RuliuMessageSenderConfig,
} from './ruliu-message-sender.js';

// Crypto utilities
export { RuliuCrypto, type RuliuCryptoConfig } from './ruliu-crypto.js';

// Types
export type {
  RuliuClient,
  RuliuMessageSenderConfig as RuliuSenderConfig,
  RuliuFileDownloadFunction,
  RuliuFileHandlerConfig,
  RuliuMessageType,
  RuliuMessageContent,
  RuliuMessageEvent,
  RuliuReactionEvent,
  RuliuWebhookConfig,
} from './types.js';