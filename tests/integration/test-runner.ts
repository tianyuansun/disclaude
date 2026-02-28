/**
 * Integration Test Runner Framework.
 *
 * A lightweight test framework for integration tests that doesn't depend on vitest.
 * Provides utilities for:
 * - Starting/stopping the PrimaryNode with REST channel
 * - Making HTTP requests to the REST API
 * - Asserting results
 * - Reporting test results
 *
 * @example
 * ```typescript
 * const runner = new TestRunner();
 * await runner.setup();
 * try {
 *   await runner.test('my test', async () => {
 *     const response = await runner.sendChat('hello');
 *     runner.assert(response.success, 'Response should be successful');
 *   });
 * } finally {
 *   await runner.teardown();
 * }
 * ```
 */

import * as http from 'node:http';
import { spawn, ChildProcess } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Test result status.
 */
export type TestStatus = 'pass' | 'fail' | 'skip';

/**
 * Single test result.
 */
export interface TestResult {
  /** Test name */
  name: string;
  /** Test status */
  status: TestStatus;
  /** Duration in milliseconds */
  duration: number;
  /** Error message if failed */
  error?: string;
  /** Stack trace if failed */
  stack?: string;
}

/**
 * Test suite results.
 */
export interface TestSuiteResult {
  /** Suite name */
  name: string;
  /** All test results */
  tests: TestResult[];
  /** Total duration in milliseconds */
  duration: number;
  /** Summary counts */
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
}

/**
 * Chat request options.
 */
export interface ChatOptions {
  /** Chat/conversation ID */
  chatId?: string;
  /** User message */
  message: string;
  /** User ID */
  userId?: string;
  /** Thread ID */
  threadId?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Chat response.
 */
export interface ChatResponse {
  /** Success status */
  success: boolean;
  /** Message ID */
  messageId: string;
  /** Chat ID */
  chatId: string;
  /** Response text (sync mode) */
  response?: string;
  /** Error message */
  error?: string;
}

/**
 * Health check response.
 */
export interface HealthResponse {
  status: string;
  channel: string;
  id: string;
}

/**
 * Configuration for the test runner.
 */
export interface TestRunnerConfig {
  /** REST API port (default: 3000) */
  restPort?: number;
  /** WebSocket port (default: 3001) */
  wsPort?: number;
  /** Host (default: localhost) */
  host?: string;
  /** Startup timeout in milliseconds (default: 30000) */
  startupTimeout?: number;
  /** Request timeout in milliseconds (default: 120000) */
  requestTimeout?: number;
  /** Whether to show server logs (default: false) */
  showServerLogs?: boolean;
}

/**
 * Colors for console output.
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

/**
 * Format duration in human-readable form.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Integration Test Runner.
 *
 * Manages the lifecycle of the test server and provides utilities for testing.
 */
export class TestRunner {
  private config: Required<TestRunnerConfig>;
  private serverProcess?: ChildProcess;
  private testResults: TestResult[] = [];
  private suiteStartTime = 0;

  constructor(config: TestRunnerConfig = {}) {
    this.config = {
      restPort: config.restPort ?? 3000,
      wsPort: config.wsPort ?? 3001,
      host: config.host ?? 'localhost',
      startupTimeout: config.startupTimeout ?? 30000,
      requestTimeout: config.requestTimeout ?? 120000,
      showServerLogs: config.showServerLogs ?? false,
    };
  }

  /**
   * Get the base URL for the REST API.
   */
  get baseUrl(): string {
    return `http://${this.config.host}:${this.config.restPort}`;
  }

  /**
   * Setup the test environment.
   * Starts the PrimaryNode with REST channel.
   */
  async setup(): Promise<void> {
    console.log(`\n${colors.cyan}Setting up test environment...${colors.reset}\n`);

    // Start the server process
    // Note: Feishu channel is disabled by clearing FEISHU_APP_ID and FEISHU_APP_SECRET env vars
    this.serverProcess = spawn('node', [
      '--import', 'tsx/esm',
      'src/cli-entry.ts',
      'start',
      '--mode', 'primary',
      '--port', String(this.config.wsPort),
      '--rest-port', String(this.config.restPort),
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // Disable Feishu by clearing these env vars
        FEISHU_APP_ID: '',
        FEISHU_APP_SECRET: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Handle server output
    if (this.config.showServerLogs) {
      this.serverProcess.stdout?.on('data', (data) => {
        process.stdout.write(data);
      });
      this.serverProcess.stderr?.on('data', (data) => {
        process.stderr.write(data);
      });
    }

    // Wait for server to be ready
    const startTime = Date.now();
    while (Date.now() - startTime < this.config.startupTimeout) {
      try {
        await this.healthCheck();
        console.log(`${colors.green}✓${colors.reset} Test server ready on ${this.baseUrl}\n`);
        return;
      } catch {
        await sleep(500);
      }
    }

    throw new Error(`Server failed to start within ${this.config.startupTimeout}ms`);
  }

  /**
   * Teardown the test environment.
   * Stops the PrimaryNode.
   */
  async teardown(): Promise<void> {
    console.log(`\n${colors.cyan}Tearing down test environment...${colors.reset}`);

    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        this.serverProcess?.on('exit', () => resolve());
        setTimeout(() => {
          this.serverProcess?.kill('SIGKILL');
          resolve();
        }, 5000);
      });

      this.serverProcess = undefined;
    }

    console.log(`${colors.green}✓${colors.reset} Test server stopped\n`);
  }

  /**
   * Check server health.
   */
  async healthCheck(): Promise<HealthResponse> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        `${this.baseUrl}/api/health`,
        { method: 'GET' },
        (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve(JSON.parse(body) as HealthResponse);
            } else {
              reject(new Error(`Health check failed: ${res.statusCode}`));
            }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  /**
   * Send a chat message (synchronous mode).
   * Waits for the complete response.
   */
  async sendChat(options: ChatOptions): Promise<ChatResponse> {
    const { chatId, message, userId, threadId, timeout } = options;

    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        chatId,
        message,
        userId,
        threadId,
      });

      const req = http.request(
        `${this.baseUrl}/api/chat/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: timeout ?? this.config.requestTimeout,
        },
        (res) => {
          let responseBody = '';
          res.on('data', (chunk) => responseBody += chunk);
          res.on('end', () => {
            try {
              const response = JSON.parse(responseBody) as ChatResponse;
              resolve(response);
            } catch {
              reject(new Error(`Invalid JSON response: ${responseBody}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Run a single test.
   */
  async test(name: string, fn: () => Promise<void>): Promise<TestResult> {
    const startTime = Date.now();

    try {
      await fn();
      const duration = Date.now() - startTime;

      const result: TestResult = {
        name,
        status: 'pass',
        duration,
      };

      console.log(`  ${colors.green}✓${colors.reset} ${name} ${colors.dim}(${formatDuration(duration)})${colors.reset}`);
      this.testResults.push(result);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const err = error as Error;

      const result: TestResult = {
        name,
        status: 'fail',
        duration,
        error: err.message,
        stack: err.stack,
      };

      console.log(`  ${colors.red}✗${colors.reset} ${name} ${colors.dim}(${formatDuration(duration)})${colors.reset}`);
      console.log(`    ${colors.red}Error: ${err.message}${colors.reset}`);
      this.testResults.push(result);
      return result;
    }
  }

  /**
   * Skip a test.
   */
  skip(name: string, reason: string): TestResult {
    const result: TestResult = {
      name,
      status: 'skip',
      duration: 0,
      error: reason,
    };

    console.log(`  ${colors.yellow}○${colors.reset} ${name} ${colors.dim}(skipped: ${reason})${colors.reset}`);
    this.testResults.push(result);
    return result;
  }

  /**
   * Assert a condition.
   */
  assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /**
   * Assert equality.
   */
  assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(
        `Assertion failed: ${message || 'Values not equal'}\n` +
        `  Expected: ${JSON.stringify(expected)}\n` +
        `  Actual: ${JSON.stringify(actual)}`
      );
    }
  }

  /**
   * Assert that a string contains another string.
   */
  assertContains(haystack: string, needle: string, message?: string): void {
    if (!haystack.includes(needle)) {
      throw new Error(
        `Assertion failed: ${message || 'String not found'}\n` +
        `  Expected to contain: "${needle}"\n` +
        `  Actual: "${haystack.substring(0, 200)}..."`
      );
    }
  }

  /**
   * Assert that a value is defined (not null or undefined).
   */
  assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
    if (value === null || value === undefined) {
      throw new Error(`Assertion failed: ${message || 'Value is not defined'}`);
    }
  }

  /**
   * Start a test suite.
   */
  startSuite(name: string): void {
    this.testResults = [];
    this.suiteStartTime = Date.now();
    console.log(`\n${colors.cyan}▶ ${name}${colors.reset}\n`);
  }

  /**
   * Get test suite results.
   */
  getResults(): TestSuiteResult {
    const duration = Date.now() - this.suiteStartTime;
    const passed = this.testResults.filter(r => r.status === 'pass').length;
    const failed = this.testResults.filter(r => r.status === 'fail').length;
    const skipped = this.testResults.filter(r => r.status === 'skip').length;

    return {
      name: 'Integration Tests',
      tests: this.testResults,
      duration,
      summary: {
        total: this.testResults.length,
        passed,
        failed,
        skipped,
      },
    };
  }

  /**
   * Print test suite summary.
   */
  printSummary(): void {
    const results = this.getResults();
    const { summary } = results;

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`${colors.cyan}Test Summary${colors.reset}\n`);

    console.log(`  Total:   ${summary.total}`);
    console.log(`  ${colors.green}Passed:  ${summary.passed}${colors.reset}`);
    if (summary.failed > 0) {
      console.log(`  ${colors.red}Failed:  ${summary.failed}${colors.reset}`);
    }
    if (summary.skipped > 0) {
      console.log(`  ${colors.yellow}Skipped: ${summary.skipped}${colors.reset}`);
    }

    console.log(`\n  Duration: ${formatDuration(results.duration)}`);

    if (summary.failed > 0) {
      console.log(`\n${colors.red}✗ Some tests failed${colors.reset}`);
    } else {
      console.log(`\n${colors.green}✓ All tests passed${colors.reset}`);
    }

    console.log(`${'─'.repeat(50)}\n`);
  }
}

/**
 * Sleep utility.
 */
export { sleep };

/**
 * Generate a unique chat ID for testing.
 */
export function generateChatId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}
