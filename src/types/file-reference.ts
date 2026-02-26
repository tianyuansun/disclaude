/**
 * File reference types for communication between nodes.
 *
 * @deprecated - Import from '../file-transfer/types.js' instead.
 * This file is kept for backward compatibility only.
 *
 * When Communication Node and Execution Node are deployed separately,
 * file references (FileReference) are used to pass file identifiers
 * instead of local file paths.
 */

// Re-export from new unified location
export {
  // Types
  type FileRef,
  type InboundAttachment,
  type OutboundFile,
  type FileReference,
  type FileAttachment,
  type FileUploadRequest,
  type FileUploadResponse,
  type FileDownloadResponse,
  type StoredFile,
  // Factory functions
  createFileRef,
  createInboundAttachment,
  createOutboundFile,
} from '../file-transfer/types.js';

// Legacy factory function alias
// @deprecated - Use createFileRef instead
import { createFileRef } from '../file-transfer/types.js';
export const createFileReference = createFileRef;
