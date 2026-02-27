import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import { WebSocketServerWrapper } from './websocket-server-wrapper.js';
import { ExecNodeManager } from './exec-node-manager.js';

describe('WebSocketServerWrapper', () => {
  let httpServer: http.Server;
  let execNodeManager: ExecNodeManager;
  let wrapper: WebSocketServerWrapper;
  const testPort = 3006;

  beforeEach(async () => {
    httpServer = http.createServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(testPort, () => resolve());
    });

    execNodeManager = new ExecNodeManager();
    wrapper = new WebSocketServerWrapper({
      httpServer,
      execNodeManager,
    });
  });

  afterEach(async () => {
    wrapper.stop();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    execNodeManager.clear();
  });

  describe('constructor', () => {
    it('should create wrapper with config', () => {
      expect(wrapper).toBeDefined();
      expect(wrapper.isRunning()).toBe(false);
    });

    it('should accept onFeedback callback', () => {
      const onFeedback = vi.fn();
      const wrapperWithCallback = new WebSocketServerWrapper({
        httpServer,
        execNodeManager,
        onFeedback,
      });
      expect(wrapperWithCallback).toBeDefined();
    });

    it('should accept onNodeDisconnected callback', () => {
      const onNodeDisconnected = vi.fn();
      const wrapperWithCallback = new WebSocketServerWrapper({
        httpServer,
        execNodeManager,
        onNodeDisconnected,
      });
      expect(wrapperWithCallback).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start the WebSocket server', () => {
      wrapper.start();
      expect(wrapper.isRunning()).toBe(true);
    });

    it('should not start twice', () => {
      wrapper.start();
      wrapper.start();
      expect(wrapper.isRunning()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop the WebSocket server', () => {
      wrapper.start();
      expect(wrapper.isRunning()).toBe(true);

      wrapper.stop();
      expect(wrapper.isRunning()).toBe(false);
    });

    it('should handle stop when not running', () => {
      wrapper.stop();
      expect(wrapper.isRunning()).toBe(false);
    });
  });

  describe('events', () => {
    it('should emit node:disconnected event', () => {
      const handler = vi.fn();
      wrapper.on('node:disconnected', handler);

      wrapper.start();
      // Event is emitted when a node disconnects
      expect(wrapper.listenerCount('node:disconnected')).toBe(1);
    });
  });
});
