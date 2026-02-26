/**
 * Inbound file transfer components.
 *
 * Handles files uploaded by users to the system.
 */

export { downloadFile, extractFileExtension } from './file-downloader.js';

export {
  AttachmentManager,
  attachmentManager,
} from './attachment-manager.js';
