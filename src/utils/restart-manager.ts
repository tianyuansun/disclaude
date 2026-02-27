/**
 * Restart Manager with exponential backoff and circuit breaker.
 *
 * Prevents infinite restart loops when SDK subprocess fails repeatedly.
 * Implements:
 * - Exponential backoff between restarts
 * - Circuit breaker to stop restarts after too many failures
 * - Automatic recovery after cooldown period
 */

/**
 * Configuration for RestartManager.
 */
export interface RestartManagerConfig {
  /** Maximum number of restart attempts before opening circuit (default: 3) */
  maxRestarts?: number;
  /** Initial delay in milliseconds (default: 1000ms) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000ms) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Cooldown period in milliseconds before resetting failure count (default: 60000ms) */
  cooldownMs?: number;
  /** Callback when circuit opens */
  onCircuitOpen?: (chatId: string, failureCount: number) => void;
  /** Callback before restart attempt */
  onRestart?: (chatId: string, attempt: number, delay: number) => void;
}

/**
 * State for a single chat's restart tracking.
 */
interface ChatRestartState {
  /** Number of consecutive failures */
  failureCount: number;
  /** Timestamp of last failure */
  lastFailureTime: number;
  /** Whether circuit is open (restarts blocked) */
  circuitOpen: boolean;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Required<Omit<RestartManagerConfig, 'onCircuitOpen' | 'onRestart'>> = {
  maxRestarts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  cooldownMs: 60000, // 1 minute
};

/**
 * Manages restart logic with backoff and circuit breaker pattern.
 *
 * Usage:
 * ```typescript
 * const manager = new RestartManager({
 *   maxRestarts: 3,
 *   onCircuitOpen: (chatId) => logger.warn(`Circuit opened for ${chatId}`),
 * });
 *
 * if (manager.shouldRestart(chatId)) {
 *   const delay = manager.getDelay(chatId);
 *   await sleep(delay);
 *   // perform restart
 *   manager.recordRestart(chatId);
 * } else {
 *   // circuit is open, don't restart
 * }
 * ```
 */
export class RestartManager {
  private readonly config: Required<RestartManagerConfig>;
  private readonly states = new Map<string, ChatRestartState>();

  constructor(config: RestartManagerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      onCircuitOpen: config.onCircuitOpen,
      onRestart: config.onRestart,
    };
  }

  /**
   * Check if restart is allowed for a chat.
   * Returns false if circuit is open or cooldown period has passed.
   *
   * @param chatId - Chat identifier
   * @returns true if restart should be attempted
   */
  shouldRestart(chatId: string): boolean {
    const state = this.getOrCreateState(chatId);

    // Check if cooldown period has passed - reset failure count
    const timeSinceLastFailure = Date.now() - state.lastFailureTime;
    if (state.failureCount > 0 && timeSinceLastFailure > this.config.cooldownMs) {
      this.resetState(chatId);
      return true;
    }

    // Check if circuit is open
    if (state.circuitOpen) {
      return false;
    }

    // Check if max restarts exceeded
    if (state.failureCount >= this.config.maxRestarts) {
      this.openCircuit(chatId);
      return false;
    }

    return true;
  }

  /**
   * Get the delay before next restart attempt.
   * Uses exponential backoff.
   *
   * @param chatId - Chat identifier
   * @returns Delay in milliseconds
   */
  getDelay(chatId: string): number {
    const state = this.getOrCreateState(chatId);
    const baseDelay = this.config.initialDelayMs *
      Math.pow(this.config.backoffMultiplier, state.failureCount);
    return Math.min(baseDelay, this.config.maxDelayMs);
  }

  /**
   * Record a restart attempt for a chat.
   * Increments failure count and updates last failure time.
   * Opens circuit if max restarts exceeded.
   *
   * @param chatId - Chat identifier
   */
  recordRestart(chatId: string): void {
    const state = this.getOrCreateState(chatId);

    // Calculate delay before incrementing (uses current failure count)
    const delay = this.getDelay(chatId);

    state.failureCount++;
    state.lastFailureTime = Date.now();

    this.config.onRestart?.(chatId, state.failureCount, delay);

    // Open circuit if max restarts exceeded
    if (state.failureCount >= this.config.maxRestarts) {
      this.openCircuit(chatId);
    }
  }

  /**
   * Record a successful operation, resetting the failure count.
   * Call this when the agent loop completes successfully.
   *
   * @param chatId - Chat identifier
   */
  recordSuccess(chatId: string): void {
    this.resetState(chatId);
  }

  /**
   * Manually reset the restart state for a chat.
   * Call this after user intervention or explicit reset.
   *
   * @param chatId - Chat identifier
   */
  reset(chatId: string): void {
    this.resetState(chatId);
  }

  /**
   * Get current failure count for a chat.
   *
   * @param chatId - Chat identifier
   * @returns Number of consecutive failures
   */
  getFailureCount(chatId: string): number {
    return this.getOrCreateState(chatId).failureCount;
  }

  /**
   * Check if circuit is open for a chat.
   *
   * @param chatId - Chat identifier
   * @returns true if circuit is open (restarts blocked)
   */
  isCircuitOpen(chatId: string): boolean {
    return this.getOrCreateState(chatId).circuitOpen;
  }

  /**
   * Get or create state for a chat.
   */
  private getOrCreateState(chatId: string): ChatRestartState {
    let state = this.states.get(chatId);
    if (!state) {
      state = {
        failureCount: 0,
        lastFailureTime: 0,
        circuitOpen: false,
      };
      this.states.set(chatId, state);
    }
    return state;
  }

  /**
   * Reset state for a chat.
   */
  private resetState(chatId: string): void {
    this.states.set(chatId, {
      failureCount: 0,
      lastFailureTime: 0,
      circuitOpen: false,
    });
  }

  /**
   * Open the circuit for a chat.
   */
  private openCircuit(chatId: string): void {
    const state = this.getOrCreateState(chatId);
    state.circuitOpen = true;
    this.config.onCircuitOpen?.(chatId, state.failureCount);
  }
}
