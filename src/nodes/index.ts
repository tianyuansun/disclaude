/**
 * Nodes module - Communication node and managers.
 *
 * The Communication node handles multiple channels (Feishu, REST, etc.)
 * and forwards prompts to Execution Node via WebSocket.
 *
 * Components:
 * - CommunicationNode: Main entry point for communication management
 * - ExecNodeManager: Manages execution node connections and routing
 * - ChannelManager: Manages communication channels
 * - HttpServerWrapper: Handles HTTP server for health check and file API
 * - WebSocketServerWrapper: Handles WebSocket server for execution nodes
 * - CommandResponseFormatter: Formats control command responses
 *
 * Usage:
 * ```typescript
 * import { CommunicationNode } from './nodes/index.js';
 *
 * // Communication Node (handles multiple channels)
 * const commNode = new CommunicationNode({
 *   port: 3001,
 *   appId: '...',
 *   appSecret: '...',
 *   enableRestChannel: true,
 * });
 *
 * await commNode.start();
 * ```
 */

export { CommunicationNode, type CommunicationNodeConfig } from './communication-node.js';
export { ExecNodeManager, type ConnectedExecNode } from './exec-node-manager.js';
export { ChannelManager } from './channel-manager.js';
export { HttpServerWrapper, type HttpServerConfig } from './http-server-wrapper.js';
export { WebSocketServerWrapper, type WebSocketServerConfig } from './websocket-server-wrapper.js';
export { CommandResponseFormatter, type ChannelStatusInfo } from './command-response-formatter.js';
