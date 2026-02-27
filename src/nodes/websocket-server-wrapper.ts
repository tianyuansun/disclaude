/**
 * WebSocketServerWrapper - Handles WebSocket server for execution node connections.
 *
 * This module handles:
 * - WebSocket server creation and lifecycle
 * - Execution node connection handling
 * - Message routing to ExecNodeManager
 *
 * Extracted from CommunicationNode for better separation of concerns.
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';
import type { ExecNodeManager } from './exec-node-manager.js';
import type { FeedbackMessage, RegisterMessage } from '../types/websocket-messages.js';

const logger = createLogger('WebSocketServerWrapper');

/**
 * Configuration for WebSocketServerWrapper.
 */
export interface WebSocketServerConfig {
  /** HTTP server to attach WebSocket to */
  httpServer: http.Server;
  /** Execution node manager for registration */
  execNodeManager: ExecNodeManager;
  /** Callback when feedback is received */
  onFeedback?: (message: FeedbackMessage) => Promise<void>;
  /** Callback when node disconnects */
  onNodeDisconnected?: (nodeId: string | undefined) => void;
}

/**
 * WebSocketServerWrapper - Manages WebSocket server for execution node connections.
 *
 * Features:
 * - Handles execution node registration
 * - Routes feedback messages
 * - Auto-registration for backward compatibility
 */
export class WebSocketServerWrapper extends EventEmitter {
  private wss?: WebSocketServer;
  private config: WebSocketServerConfig;

  constructor(config: WebSocketServerConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the WebSocket server.
   */
  start(): void {
    if (this.wss) {
      logger.warn('WebSocket server already running');
      return;
    }

    this.wss = new WebSocketServer({ server: this.config.httpServer });

    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      let currentNodeId: string | undefined;

      logger.info({ clientIp }, 'Execution Node connecting...');

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Handle registration message
          if (message.type === 'register') {
            const regMsg = message as RegisterMessage;
            currentNodeId = this.config.execNodeManager.register(ws, regMsg, clientIp);
            return;
          }

          // Handle feedback message
          const feedbackMsg = message as FeedbackMessage;
          if (this.config.onFeedback) {
            void this.config.onFeedback(feedbackMsg);
          }
        } catch (error) {
          logger.error({ err: error }, 'Failed to parse message');
        }
      });

      ws.on('close', () => {
        if (currentNodeId) {
          this.config.execNodeManager.unregister(currentNodeId);
        }
        this.config.onNodeDisconnected?.(currentNodeId);
        this.emit('node:disconnected', currentNodeId);
      });

      ws.on('error', (error) => {
        logger.error({ err: error, nodeId: currentNodeId }, 'WebSocket error');
      });

      // Auto-registration timeout for backward compatibility
      const registrationTimeout = setTimeout(() => {
        if (!currentNodeId && ws.readyState === WebSocket.OPEN) {
          const autoNodeId = `exec-${Date.now()}`;
          currentNodeId = this.config.execNodeManager.register(
            ws,
            { type: 'register', nodeId: autoNodeId, name: 'Auto-registered Node' },
            clientIp
          );
          logger.info({ nodeId: currentNodeId }, 'Auto-registered execution node (backward compatibility)');
        }
      }, 1000);

      ws.on('close', () => clearTimeout(registrationTimeout));
    });

    logger.info('WebSocket server started');
  }

  /**
   * Stop the WebSocket server.
   */
  stop(): void {
    if (!this.wss) {
      return;
    }

    this.wss.close();
    this.wss = undefined;
    logger.info('WebSocket server stopped');
  }

  /**
   * Check if the server is running.
   */
  isRunning(): boolean {
    return this.wss !== undefined;
  }
}
