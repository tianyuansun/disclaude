/**
 * Communication Node - Handles multi-channel communication.
 *
 * This module manages multiple communication channels (Feishu, REST, etc.)
 * and forwards prompts to Execution Node via WebSocket.
 *
 * Architecture:
 * ```
 *                    ┌─────────────────────────────┐
 *   Feishu Channel ──│                             │
 *   REST Channel   ──│    Communication Node       │── Execution Node
 *   (future)       ──│    (Channel Multiplexer)    │    (via WebSocket)
 *                    │                             │
 *                    └─────────────────────────────┘
 */

import { EventEmitter } from 'events';
import { Config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';
import type { IChannel, IncomingMessage, OutgoingMessage, ControlCommand, ControlResponse } from '../channels/index.js';
import { FeishuChannel } from '../channels/feishu-channel.js';
import { RestChannel } from '../channels/rest-channel.js';
import type { PromptMessage, CommandMessage, FeedbackMessage } from '../types/websocket-messages.js';
import type { FileReference } from '../types/file-reference.js';
import { FileStorageService, type FileStorageConfig } from '../services/file-storage-service.js';
import { ExecNodeManager } from './exec-node-manager.js';
import { ChannelManager } from './channel-manager.js';
import { HttpServerWrapper } from './http-server-wrapper.js';
import { WebSocketServerWrapper } from './websocket-server-wrapper.js';
import { CommandResponseFormatter } from './command-response-formatter.js';

const logger = createLogger('CommunicationNode');

/**
 * Configuration for Communication Node.
 */
export interface CommunicationNodeConfig {
  /** Port for WebSocket server (default: 3001) */
  port: number;
  /** Host for WebSocket server */
  host?: string;
  /** Feishu App ID (for backward compatibility) */
  appId?: string;
  /** Feishu App Secret (for backward compatibility) */
  appSecret?: string;
  /** REST channel port (default: 3000) */
  restPort?: number;
  /** Enable REST channel */
  enableRestChannel?: boolean;
  /** REST channel auth token */
  restAuthToken?: string;
  /** Custom channels to register */
  channels?: IChannel[];
  /** File storage configuration */
  fileStorage?: FileStorageConfig;
}

/**
 * Communication Node - Manages multiple channels and WebSocket communication with Execution Node.
 *
 * Responsibilities:
 * - Manages multiple communication channels (Feishu, REST, etc.)
 * - Runs WebSocket server for Execution Nodes to connect
 * - Supports multiple Execution Nodes with chat-level routing
 * - Forwards prompts from channels to assigned Execution Node via WebSocket
 * - Receives feedback from Execution Node via WebSocket
 * - Routes feedback back to appropriate channels
 */
export class CommunicationNode extends EventEmitter {
  private port: number;
  private host: string;
  private running = false;

  // Managers
  private execNodeManager: ExecNodeManager;
  private channelManager: ChannelManager;

  // Server wrappers
  private httpServer?: HttpServerWrapper;
  private wsServer?: WebSocketServerWrapper;

  // File storage service
  private fileStorageService?: FileStorageService;
  private fileStorageConfig?: FileStorageConfig;

  constructor(config: CommunicationNodeConfig) {
    super();
    this.port = config.port;
    this.host = config.host || '0.0.0.0';

    // Initialize managers
    this.execNodeManager = new ExecNodeManager();
    this.channelManager = new ChannelManager();

    // Store file storage config for later initialization
    this.fileStorageConfig = config.fileStorage;

    // Register custom channels if provided
    if (config.channels) {
      for (const channel of config.channels) {
        this.registerChannel(channel);
      }
    }

    // Create Feishu channel (for backward compatibility)
    const appId = config.appId || Config.FEISHU_APP_ID;
    const appSecret = config.appSecret || Config.FEISHU_APP_SECRET;
    if (appId && appSecret) {
      const feishuChannel = new FeishuChannel({
        id: 'feishu',
        appId,
        appSecret,
      });

      // Initialize TaskFlowOrchestrator for Feishu channel
      feishuChannel.initTaskFlowOrchestrator({
        sendMessage: this.sendMessage.bind(this),
        sendCard: this.sendCard.bind(this),
        sendFile: this.sendFileToUser.bind(this),
      });

      this.registerChannel(feishuChannel);
      logger.info('Feishu channel registered');
    }

    // Create REST channel if enabled
    if (config.enableRestChannel !== false) {
      const restChannel = new RestChannel({
        id: 'rest',
        port: config.restPort || 3000,
        authToken: config.restAuthToken,
      });
      this.registerChannel(restChannel);
      logger.info({ port: config.restPort || 3000 }, 'REST channel registered');
    }

    logger.info({ port: this.port, host: this.host }, 'CommunicationNode created');
  }

  /**
   * Register a communication channel.
   */
  registerChannel(channel: IChannel): void {
    this.channelManager.register(channel);

    // Set up handlers
    this.channelManager.setupHandlers(
      channel,
      async (message: IncomingMessage) => {
        logger.debug({ channelId: channel.id, messageId: message.messageId }, 'handleChannelMessage invoked');
        await this.handleChannelMessage(channel.id, message);
        logger.debug({ channelId: channel.id, messageId: message.messageId }, 'handleChannelMessage completed');
      },
      (command: ControlCommand) => this.handleControlCommand(command)
    );
  }

  /**
   * Get a registered channel by ID.
   */
  getChannel(channelId: string): IChannel | undefined {
    return this.channelManager.get(channelId);
  }

  /**
   * Get all registered channels.
   */
  getChannels(): IChannel[] {
    return this.channelManager.getAll();
  }

  // ===== ExecNode delegation methods =====

  /**
   * Get list of all connected execution nodes.
   */
  getExecNodes() {
    return this.execNodeManager.getStats();
  }

  /**
   * Get the node assignment for a specific chat.
   */
  getChatNodeAssignment(chatId: string): string | undefined {
    return this.execNodeManager.getChatAssignment(chatId);
  }

  /**
   * Switch a chat to a specific execution node.
   */
  switchChatNode(chatId: string, targetNodeId: string): boolean {
    return this.execNodeManager.switchChatNode(chatId, targetNodeId);
  }

  /**
   * Start servers for Execution Node connections.
   */
  private async startServers(): Promise<void> {
    // Initialize file storage service if configured
    if (this.fileStorageConfig) {
      this.fileStorageService = new FileStorageService(this.fileStorageConfig);
      await this.fileStorageService.initialize();
      logger.info('File storage service initialized');
    }

    // Create and start HTTP server wrapper
    this.httpServer = new HttpServerWrapper({
      port: this.port,
      host: this.host,
      fileStorageService: this.fileStorageService,
      getChannelIds: () => this.channelManager.getIds(),
    });

    await this.httpServer.start();

    // Create and start WebSocket server wrapper
    const httpServer = this.httpServer.getServer();
    if (!httpServer) {
      throw new Error('HTTP server not available');
    }

    this.wsServer = new WebSocketServerWrapper({
      httpServer,
      execNodeManager: this.execNodeManager,
      onFeedback: (message) => this.handleFeedback(message),
      onNodeDisconnected: (nodeId) => this.emit('exec:disconnected', nodeId),
    });

    this.wsServer.start();
    logger.info({ port: this.port, host: this.host }, 'WebSocket server started');
  }

  /**
   * Handle message from a channel.
   */
  private async handleChannelMessage(_channelId: string, message: IncomingMessage): Promise<void> {
    logger.debug({ chatId: message.chatId, messageId: message.messageId, content: message.content?.substring(0, 100) }, 'Processing channel message');

    // Process attachments if present
    let attachments: FileReference[] | undefined;
    if (message.attachments && message.attachments.length > 0 && this.fileStorageService) {
      attachments = [];
      for (const att of message.attachments) {
        try {
          const fileRef = await this.fileStorageService.storeFromLocal(
            att.filePath,
            att.fileName,
            att.mimeType,
            'user',
            message.chatId
          );
          attachments.push(fileRef);
          logger.info({ fileId: fileRef.id, fileName: att.fileName }, 'Attachment stored');
        } catch (error) {
          logger.error({ err: error, fileName: att.fileName }, 'Failed to store attachment');
        }
      }
    }

    // Send prompt to Execution Node
    logger.debug({ chatId: message.chatId, messageId: message.messageId }, 'Calling sendPrompt');
    await this.sendPrompt({
      type: 'prompt',
      chatId: message.chatId,
      prompt: message.content,
      messageId: message.messageId,
      senderOpenId: message.userId,
      threadId: message.threadId,
      attachments,
    });
  }

  /**
   * Handle control command using CommandResponseFormatter.
   */
  private async handleControlCommand(command: ControlCommand): Promise<ControlResponse> {
    switch (command.type) {
      case 'reset':
        await this.sendCommand({ type: 'command', command: 'reset', chatId: command.chatId });
        return CommandResponseFormatter.formatReset();

      case 'restart':
        await this.sendCommand({ type: 'command', command: 'restart', chatId: command.chatId });
        return CommandResponseFormatter.formatRestart();

      case 'status': {
        const currentNodeId = this.execNodeManager.getChatAssignment(command.chatId);
        return CommandResponseFormatter.formatStatus(
          this.running,
          this.execNodeManager.getStats(),
          this.channelManager.getStatusInfo(),
          currentNodeId
        );
      }

      case 'list-nodes': {
        const currentNodeId = this.execNodeManager.getChatAssignment(command.chatId);
        return CommandResponseFormatter.formatListNodes(
          this.execNodeManager.getStats(),
          currentNodeId
        );
      }

      case 'switch-node': {
        const targetNodeId = command.targetNodeId;
        if (!targetNodeId) {
          return CommandResponseFormatter.formatSwitchNodeUsage(this.execNodeManager.getStats());
        }

        const success = this.execNodeManager.switchChatNode(command.chatId, targetNodeId);
        if (success) {
          const node = this.execNodeManager.getNode(targetNodeId);
          return CommandResponseFormatter.formatSwitchNodeSuccess(node?.name || targetNodeId);
        } else {
          return CommandResponseFormatter.formatSwitchNodeError(targetNodeId);
        }
      }

      default:
        return CommandResponseFormatter.formatUnknownCommand(command.type);
    }
  }

  /**
   * Send prompt to Execution Node via WebSocket.
   */
  private async sendPrompt(message: PromptMessage): Promise<void> {
    logger.debug({ chatId: message.chatId, messageId: message.messageId }, 'sendPrompt called');

    const execNode = this.execNodeManager.getForChat(message.chatId);
    if (!execNode) {
      logger.warn('No Execution Node available');
      await this.sendMessage(message.chatId, '❌ 没有可用的执行节点');
      throw new Error('No Execution Node available');
    }

    execNode.ws.send(JSON.stringify(message));
    logger.info({ chatId: message.chatId, messageId: message.messageId, threadId: message.threadId, nodeId: execNode.nodeId }, 'Prompt sent to Execution Node');
  }

  /**
   * Send command to Execution Node via WebSocket.
   */
  private async sendCommand(message: CommandMessage): Promise<void> {
    const execNode = this.execNodeManager.getForChat(message.chatId);
    if (!execNode) {
      logger.warn('No Execution Node available');
      await this.sendMessage(message.chatId, '❌ 没有可用的执行节点');
      throw new Error('No Execution Node available');
    }

    execNode.ws.send(JSON.stringify(message));
    logger.info({ chatId: message.chatId, command: message.command, nodeId: execNode.nodeId }, 'Command sent to Execution Node');
  }

  /**
   * Handle feedback from Execution Node.
   */
  private async handleFeedback(message: FeedbackMessage): Promise<void> {
    const { chatId, type, text, card, error, threadId, fileRef } = message;

    try {
      switch (type) {
        case 'text':
          if (text) {
            await this.sendMessage(chatId, text, threadId);
          }
          break;
        case 'card':
          await this.sendCard(chatId, card || {}, undefined, threadId);
          break;
        case 'file':
          if (fileRef && this.fileStorageService) {
            const localPath = this.fileStorageService.getLocalPath(fileRef.id);
            if (localPath) {
              await this.sendFileToUser(chatId, localPath, threadId);
            } else {
              logger.error({ fileId: fileRef.id }, 'File not found in storage');
              await this.sendMessage(chatId, `❌ 文件未找到: ${fileRef.fileName}`, threadId);
            }
          }
          break;
        case 'done':
          logger.info({ chatId }, 'Execution completed');
          // Broadcast done signal to all channels (important for REST sync mode)
          await this.channelManager.broadcast({ type: 'done', chatId, threadId });
          break;
        case 'error':
          logger.error({ chatId, error }, 'Execution error');
          await this.sendMessage(chatId, `❌ 执行错误: ${error || 'Unknown error'}`, threadId);
          break;
      }
    } catch (err) {
      logger.error({ err, message }, 'Failed to handle feedback');
    }
  }

  /**
   * Send a text message to all channels (broadcast mode).
   * Each channel will handle the message if it recognizes the chatId.
   */
  async sendMessage(chatId: string, text: string, threadMessageId?: string): Promise<void> {
    await this.channelManager.broadcast({
      chatId,
      type: 'text',
      text,
      threadId: threadMessageId,
    });
  }

  /**
   * Send an interactive card to all channels (broadcast mode).
   * Each channel will handle the message if it recognizes the chatId.
   */
  async sendCard(
    chatId: string,
    card: Record<string, unknown>,
    description?: string,
    threadMessageId?: string
  ): Promise<void> {
    await this.channelManager.broadcast({
      chatId,
      type: 'card',
      card,
      description,
      threadId: threadMessageId,
    });
  }

  /**
   * Send a file to all channels (broadcast mode).
   * Each channel will handle the message if it recognizes the chatId.
   */
  async sendFileToUser(chatId: string, filePath: string, _threadId?: string): Promise<void> {
    // TODO: Pass threadId when Issue #68 is implemented
    await this.channelManager.broadcast({
      chatId,
      type: 'file',
      filePath,
    });
  }

  /**
   * Start the Communication Node.
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('CommunicationNode already running');
      return;
    }

    this.running = true;

    // Start servers (HTTP + WebSocket)
    await this.startServers();

    // Start all registered channels
    await this.channelManager.startAll();

    logger.info('CommunicationNode started');
    console.log('✓ Communication Node ready');
    console.log();
    console.log(`WebSocket Server: ws://${this.host}:${this.port}`);
    console.log('Channels:');
    for (const ch of this.channelManager.getStatusInfo()) {
      console.log(`  - ${ch.name} (${ch.id}): ${ch.status}`);
    }
    console.log('Waiting for Execution Nodes to connect...');
    console.log();
    console.log('Control commands available:');
    console.log('  /list-nodes  - List all connected execution nodes');
    console.log('  /switch-node <nodeId> - Switch to a specific execution node');
  }

  /**
   * Stop the Communication Node.
   */
  async stop(): Promise<void> {
    if (!this.running) {return;}

    this.running = false;

    // Shutdown file storage service
    if (this.fileStorageService) {
      this.fileStorageService.shutdown();
      this.fileStorageService = undefined;
    }

    // Stop all channels
    await this.channelManager.stopAll();

    // Close all Execution Node connections
    for (const nodeId of this.execNodeManager.getNodeIds()) {
      const node = this.execNodeManager.getNode(nodeId);
      if (node) {
        try {
          node.ws.close();
          logger.info({ nodeId }, 'Execution Node connection closed');
        } catch (error) {
          logger.error({ err: error, nodeId }, 'Failed to close Execution Node connection');
        }
      }
    }
    this.execNodeManager.clear();

    // Stop WebSocket server
    if (this.wsServer) {
      this.wsServer.stop();
      this.wsServer = undefined;
    }

    // Stop HTTP server
    if (this.httpServer) {
      await this.httpServer.stop();
      this.httpServer = undefined;
    }

    logger.info('CommunicationNode stopped');
  }

  /**
   * Check if the node is running.
   */
  isRunning(): boolean {
    return this.running;
  }
}
