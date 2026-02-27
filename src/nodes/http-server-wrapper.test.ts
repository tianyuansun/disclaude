import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpServerWrapper } from './http-server-wrapper.js';
import type { FileStorageService } from '../services/file-storage-service.js';

describe('HttpServerWrapper', () => {
  let wrapper: HttpServerWrapper;

  beforeEach(() => {
    wrapper = new HttpServerWrapper({
      port: 3002,
      host: '127.0.0.1',
    });
  });

  afterEach(async () => {
    if (wrapper) {
      await wrapper.stop();
    }
  });

  describe('constructor', () => {
    it('should create wrapper with config', () => {
      expect(wrapper).toBeDefined();
      expect(wrapper.isRunning()).toBe(false);
    });

    it('should accept optional file storage service', () => {
      const mockStorage = {} as FileStorageService;
      const wrapperWithStorage = new HttpServerWrapper({
        port: 3003,
        host: '127.0.0.1',
        fileStorageService: mockStorage,
      });
      expect(wrapperWithStorage).toBeDefined();
    });

    it('should accept getChannelIds callback', () => {
      const wrapperWithCallback = new HttpServerWrapper({
        port: 3004,
        host: '127.0.0.1',
        getChannelIds: () => ['feishu', 'rest'],
      });
      expect(wrapperWithCallback).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start the HTTP server', async () => {
      await wrapper.start();
      expect(wrapper.isRunning()).toBe(true);
      expect(wrapper.getServer()).toBeDefined();
    });

    it('should not start twice', async () => {
      await wrapper.start();
      await wrapper.start();
      expect(wrapper.isRunning()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop the HTTP server', async () => {
      await wrapper.start();
      expect(wrapper.isRunning()).toBe(true);

      await wrapper.stop();
      expect(wrapper.isRunning()).toBe(false);
    });

    it('should handle stop when not running', async () => {
      await wrapper.stop();
      expect(wrapper.isRunning()).toBe(false);
    });
  });

  describe('getServer', () => {
    it('should return undefined when not started', () => {
      expect(wrapper.getServer()).toBeUndefined();
    });

    it('should return server when started', async () => {
      await wrapper.start();
      expect(wrapper.getServer()).toBeDefined();
    });
  });

  describe('health check', () => {
    it('should respond to /health endpoint', async () => {
      await wrapper.start();
      const port = 3002;

      const response = await fetch(`http://127.0.0.1:${port}/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.mode).toBe('communication');
    });

    it('should include channels in health check when callback provided', async () => {
      const wrapperWithCallback = new HttpServerWrapper({
        port: 3005,
        host: '127.0.0.1',
        getChannelIds: () => ['feishu', 'rest'],
      });

      await wrapperWithCallback.start();

      const response = await fetch('http://127.0.0.1:3005/health');
      const data = await response.json();
      expect(data.channels).toEqual(['feishu', 'rest']);

      await wrapperWithCallback.stop();
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown paths', async () => {
      await wrapper.start();

      const response = await fetch('http://127.0.0.1:3002/unknown');
      expect(response.status).toBe(404);
    });
  });
});
