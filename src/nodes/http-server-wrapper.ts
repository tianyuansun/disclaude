/**
 * HttpServerWrapper - Handles HTTP server for health check and file API.
 *
 * This module handles:
 * - Health check endpoint
 * - File transfer API
 * - HTTP server lifecycle
 *
 * Extracted from CommunicationNode for better separation of concerns.
 */

import http from 'node:http';
import { createLogger } from '../utils/logger.js';
import type { FileStorageService } from '../services/file-storage-service.js';
import { createFileTransferAPIHandler } from '../services/file-transfer-api.js';

const logger = createLogger('HttpServerWrapper');

/**
 * Configuration for HttpServerWrapper.
 */
export interface HttpServerConfig {
  /** Port to listen on */
  port: number;
  /** Host to bind to */
  host: string;
  /** File storage service (optional) */
  fileStorageService?: FileStorageService;
  /** Callback to get channel IDs for health check */
  getChannelIds?: () => string[];
}

/**
 * HttpServerWrapper - Manages HTTP server for health check and file API.
 *
 * Features:
 * - Health check endpoint at /health
 * - File transfer API at /api/files/*
 * - Clean lifecycle management
 */
export class HttpServerWrapper {
  private server?: http.Server;
  private config: HttpServerConfig;
  private fileApiHandler: ReturnType<typeof createFileTransferAPIHandler> | null = null;

  constructor(config: HttpServerConfig) {
    this.config = config;

    if (config.fileStorageService) {
      this.fileApiHandler = createFileTransferAPIHandler({
        storageService: config.fileStorageService,
      });
    }
  }

  /**
   * Start the HTTP server.
   */
  async start(): Promise<void> {
    if (this.server) {
      logger.warn('HTTP server already running');
      return;
    }

    this.server = http.createServer(async (req, res) => {
      const url = req.url || '/';

      // Handle file API requests
      if (this.fileApiHandler && url.startsWith('/api/files')) {
        const handled = await this.fileApiHandler(req, res);
        if (handled) {
          return;
        }
      }

      // Health check
      if (url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          mode: 'communication',
          channels: this.config.getChannelIds?.() || [],
          fileStorage: this.config.fileStorageService?.getStats(),
        }));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        logger.info({ port: this.config.port, host: this.config.host }, 'HTTP server started');
        resolve();
      });
      this.server!.on('error', reject);
    });
  }

  /**
   * Stop the HTTP server.
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        logger.info('HTTP server stopped');
        this.server = undefined;
        resolve();
      });
    });
  }

  /**
   * Get the underlying HTTP server for WebSocket upgrade.
   */
  getServer(): http.Server | undefined {
    return this.server;
  }

  /**
   * Check if the server is running.
   */
  isRunning(): boolean {
    return this.server !== undefined;
  }
}
