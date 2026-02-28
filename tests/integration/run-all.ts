#!/usr/bin/env node
/**
 * Run All Integration Tests.
 *
 * This script runs all integration test suites in sequence.
 * Each test suite starts and stops its own server instance.
 *
 * Usage:
 *   node --import tsx/esm tests/integration/run-all.ts
 *
 * Options:
 *   --quick     Run only quick tests (skip long-running tests)
 *   --verbose   Show server logs
 */

import { TestRunner, type TestSuiteResult } from './test-runner.js';
import { setTimeout as sleep } from 'node:timers/promises';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

/**
 * Print a banner.
 */
function printBanner(text: string): void {
  const line = '═'.repeat(60);
  console.log(`\n${colors.cyan}${line}${colors.reset}`);
  console.log(`${colors.cyan}  ${text}${colors.reset}`);
  console.log(`${colors.cyan}${line}${colors.reset}\n`);
}

/**
 * Run a single test file.
 */
async function runTestFile(
  name: string,
  testFn: (runner: TestRunner) => Promise<void>,
  config: { restPort: number; wsPort: number; verbose: boolean }
): Promise<TestSuiteResult> {
  const runner = new TestRunner({
    restPort: config.restPort,
    wsPort: config.wsPort,
    showServerLogs: config.verbose,
    requestTimeout: 120000,
  });

  runner.startSuite(name);
  const results: TestSuiteResult = {
    name,
    tests: [],
    duration: 0,
    summary: { total: 0, passed: 0, failed: 0, skipped: 0 },
  };

  try {
    await runner.setup();
    await testFn(runner);
  } catch (error) {
    const err = error as Error;
    console.log(`  ${colors.red}✗ Suite setup failed: ${err.message}${colors.reset}`);
    results.tests.push({
      name: 'Suite Setup',
      status: 'fail',
      duration: 0,
      error: err.message,
    });
  } finally {
    await runner.teardown();
  }

  const suiteResults = runner.getResults();
  results.tests = suiteResults.tests;
  results.duration = suiteResults.duration;
  results.summary = suiteResults.summary;

  // Wait between suites to ensure clean shutdown
  await sleep(2000);

  return results;
}

/**
 * Main test runner.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const quick = args.includes('--quick');

  printBanner('Disclaude Integration Tests');

  console.log(`${colors.dim}Started at: ${new Date().toISOString()}${colors.reset}`);
  console.log(`${colors.dim}Mode: ${quick ? 'quick' : 'full'}${colors.reset}`);
  console.log(`${colors.dim}Verbose: ${verbose}${colors.reset}\n`);

  const allResults: TestSuiteResult[] = [];
  const startTime = Date.now();

  // Use different ports for each test suite to avoid conflicts
  let portOffset = 0;

  // Test Suite 1: Use Case 1 - 用户发送消息，Agent 回复
  const result1 = await runTestFile(
    'Use Case 1: 用户发送消息，Agent 回复',
    async (runner) => {
      await runner.test('简单问候 - "你好"', async () => {
        const response = await runner.sendChat({
          chatId: `test-1-${Date.now()}`,
          message: '你好',
          userId: 'test-user-1',
        });
        runner.assert(response.success, 'Response should be successful');
        runner.assertDefined(response.response, 'Response should have content');
      });

      await runner.test('英文问候 - "Hello"', async () => {
        const response = await runner.sendChat({
          chatId: `test-2-${Date.now()}`,
          message: 'Hello',
          userId: 'test-user-1',
        });
        runner.assert(response.success, 'Response should be successful');
        runner.assertDefined(response.response, 'Response should have content');
      });

      if (!quick) {
        await runner.test('自我介绍 - "你是谁？"', async () => {
          const response = await runner.sendChat({
            chatId: `test-3-${Date.now()}`,
            message: '你是谁？',
            userId: 'test-user-1',
          });
          runner.assert(response.success, 'Response should be successful');
          const responseText = response.response!.toLowerCase();
          runner.assert(
            responseText.includes('claude') ||
            responseText.includes('ai') ||
            responseText.includes('助手'),
            'Response should identify as an AI assistant'
          );
        });
      }
    },
    { restPort: 3000 + portOffset * 10, wsPort: 3001 + portOffset * 10, verbose }
  );
  allResults.push(result1);
  portOffset++;

  // Test Suite 2: Use Case 2 - 用户发送任务，Agent 执行并返回结果
  const result2 = await runTestFile(
    'Use Case 2: 用户发送任务，Agent 执行并返回结果',
    async (runner) => {
      await runner.test('简单计算 - "计算 1+1"', async () => {
        const response = await runner.sendChat({
          chatId: `test-4-${Date.now()}`,
          message: '计算 1+1 等于多少？',
          userId: 'test-user-2',
        });
        runner.assert(response.success, 'Response should be successful');
        runner.assertContains(response.response!, '2', 'Response should contain "2"');
      });

      if (!quick) {
        await runner.test('代码生成 - "写一个简单的函数"', async () => {
          const response = await runner.sendChat({
            chatId: `test-5-${Date.now()}`,
            message: '请写一个 TypeScript 函数，计算两个数的和',
            userId: 'test-user-2',
          });
          runner.assert(response.success, 'Response should be successful');
          const responseText = response.response!;
          runner.assert(
            responseText.includes('function') ||
            responseText.includes('const') ||
            responseText.includes('=>'),
            'Response should contain code'
          );
        });
      }
    },
    { restPort: 3000 + portOffset * 10, wsPort: 3001 + portOffset * 10, verbose }
  );
  allResults.push(result2);
  portOffset++;

  // Test Suite 3: Use Case 3 - 多轮对话，保持上下文
  const result3 = await runTestFile(
    'Use Case 3: 多轮对话，保持上下文',
    async (runner) => {
      await runner.test('上下文记忆 - 记住名字', async () => {
        const chatId = `test-6-${Date.now()}`;

        const response1 = await runner.sendChat({
          chatId,
          message: '你好，我叫小明',
          userId: 'test-user-3',
        });
        runner.assert(response1.success, 'First response should be successful');

        const response2 = await runner.sendChat({
          chatId,
          message: '你还记得我的名字吗？',
          userId: 'test-user-3',
        });
        runner.assert(response2.success, 'Second response should be successful');
        runner.assertContains(response2.response!, '小明', 'Agent should remember "小明"');
      });

      if (!quick) {
        await runner.test('上下文记忆 - 连续计算', async () => {
          const chatId = `test-7-${Date.now()}`;

          const response1 = await runner.sendChat({
            chatId,
            message: '计算 10 + 5',
            userId: 'test-user-3',
          });
          runner.assert(response1.success, 'First response should be successful');

          const response2 = await runner.sendChat({
            chatId,
            message: '把结果乘以 2',
            userId: 'test-user-3',
          });
          runner.assert(response2.success, 'Second response should be successful');
          runner.assertContains(response2.response!, '30', '15 * 2 should equal 30');
        });
      }
    },
    { restPort: 3000 + portOffset * 10, wsPort: 3001 + portOffset * 10, verbose }
  );
  allResults.push(result3);

  // Print final summary
  const totalDuration = Date.now() - startTime;

  printBanner('Final Summary');

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const result of allResults) {
    const { summary } = result;
    totalTests += summary.total;
    totalPassed += summary.passed;
    totalFailed += summary.failed;
    totalSkipped += summary.skipped;

    const statusIcon = summary.failed > 0
      ? `${colors.red}✗${colors.reset}`
      : `${colors.green}✓${colors.reset}`;

    console.log(
      `  ${statusIcon} ${result.name}: ` +
      `${colors.green}${summary.passed} passed${colors.reset}` +
      (summary.failed > 0 ? `, ${colors.red}${summary.failed} failed${colors.reset}` : '') +
      (summary.skipped > 0 ? `, ${colors.yellow}${summary.skipped} skipped${colors.reset}` : '')
    );
  }

  console.log(`\n  ${colors.bold}Total:${colors.reset} ${totalTests} tests`);
  console.log(`  ${colors.green}Passed:${colors.reset} ${totalPassed}`);
  if (totalFailed > 0) {
    console.log(`  ${colors.red}Failed:${colors.reset} ${totalFailed}`);
  }
  if (totalSkipped > 0) {
    console.log(`  ${colors.yellow}Skipped:${colors.reset} ${totalSkipped}`);
  }
  console.log(`  ${colors.dim}Duration: ${(totalDuration / 1000).toFixed(2)}s${colors.reset}`);

  // Exit with appropriate code
  if (totalFailed > 0) {
    console.log(`\n${colors.red}✗ Some tests failed${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}✓ All tests passed${colors.reset}\n`);
    process.exit(0);
  }
}

// Run main
main().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
