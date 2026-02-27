import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RestartManager } from './restart-manager.js';

describe('RestartManager', () => {
  let manager: RestartManager;
  const chatId = 'test-chat-123';

  beforeEach(() => {
    manager = new RestartManager({
      maxRestarts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      cooldownMs: 1000,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('shouldRestart', () => {
    it('should allow restart initially', () => {
      expect(manager.shouldRestart(chatId)).toBe(true);
    });

    it('should allow restarts up to maxRestarts', () => {
      manager.recordRestart(chatId); // 1
      expect(manager.shouldRestart(chatId)).toBe(true);

      manager.recordRestart(chatId); // 2
      expect(manager.shouldRestart(chatId)).toBe(true);

      manager.recordRestart(chatId); // 3
      expect(manager.shouldRestart(chatId)).toBe(false); // Circuit opens
    });

    it('should block restarts when circuit is open', () => {
      // Trigger circuit open
      for (let i = 0; i < 3; i++) {
        manager.recordRestart(chatId);
      }
      expect(manager.isCircuitOpen(chatId)).toBe(true);
      expect(manager.shouldRestart(chatId)).toBe(false);
    });

    it('should reset failure count after cooldown period', () => {
      manager.recordRestart(chatId);
      manager.recordRestart(chatId);
      expect(manager.getFailureCount(chatId)).toBe(2);

      // Advance past cooldown period
      vi.advanceTimersByTime(1500);

      // Should reset and allow restart
      expect(manager.shouldRestart(chatId)).toBe(true);
      expect(manager.getFailureCount(chatId)).toBe(0);
    });
  });

  describe('getDelay', () => {
    it('should return initial delay for first failure', () => {
      expect(manager.getDelay(chatId)).toBe(100);
    });

    it('should use exponential backoff', () => {
      manager.recordRestart(chatId);
      expect(manager.getDelay(chatId)).toBe(200); // 100 * 2^1

      manager.recordRestart(chatId);
      expect(manager.getDelay(chatId)).toBe(400); // 100 * 2^2
    });

    it('should cap delay at maxDelayMs', () => {
      const strictManager = new RestartManager({
        initialDelayMs: 500,
        maxDelayMs: 600,
        backoffMultiplier: 2,
      });

      strictManager.recordRestart(chatId);
      expect(strictManager.getDelay(chatId)).toBe(600); // Would be 1000, capped to 600
    });
  });

  describe('recordRestart', () => {
    it('should increment failure count', () => {
      expect(manager.getFailureCount(chatId)).toBe(0);

      manager.recordRestart(chatId);
      expect(manager.getFailureCount(chatId)).toBe(1);

      manager.recordRestart(chatId);
      expect(manager.getFailureCount(chatId)).toBe(2);
    });

    it('should call onRestart callback', () => {
      const onRestart = vi.fn();
      const callbackManager = new RestartManager({
        onRestart,
        initialDelayMs: 100,
      });

      callbackManager.recordRestart(chatId);

      expect(onRestart).toHaveBeenCalledWith(chatId, 1, 100);
    });
  });

  describe('recordSuccess', () => {
    it('should reset failure count', () => {
      manager.recordRestart(chatId);
      manager.recordRestart(chatId);
      expect(manager.getFailureCount(chatId)).toBe(2);

      manager.recordSuccess(chatId);

      expect(manager.getFailureCount(chatId)).toBe(0);
      expect(manager.isCircuitOpen(chatId)).toBe(false);
    });
  });

  describe('reset', () => {
    it('should manually reset state', () => {
      // Trigger circuit open
      for (let i = 0; i < 3; i++) {
        manager.recordRestart(chatId);
      }
      expect(manager.isCircuitOpen(chatId)).toBe(true);

      manager.reset(chatId);

      expect(manager.isCircuitOpen(chatId)).toBe(false);
      expect(manager.getFailureCount(chatId)).toBe(0);
    });
  });

  describe('circuit breaker callbacks', () => {
    it('should call onCircuitOpen when circuit opens', () => {
      const onCircuitOpen = vi.fn();
      const callbackManager = new RestartManager({
        maxRestarts: 2,
        onCircuitOpen,
      });

      callbackManager.recordRestart(chatId);
      expect(onCircuitOpen).not.toHaveBeenCalled();

      callbackManager.recordRestart(chatId);
      expect(onCircuitOpen).toHaveBeenCalledWith(chatId, 2);
    });
  });

  describe('multiple chats', () => {
    it('should track state independently per chat', () => {
      const chat1 = 'chat-1';
      const chat2 = 'chat-2';

      manager.recordRestart(chat1);
      manager.recordRestart(chat1);

      expect(manager.getFailureCount(chat1)).toBe(2);
      expect(manager.getFailureCount(chat2)).toBe(0);

      manager.recordRestart(chat2);
      expect(manager.getFailureCount(chat2)).toBe(1);
    });
  });
});
