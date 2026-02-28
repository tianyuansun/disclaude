/**
 * Use Case 1: 用户发送消息，Agent 回复
 *
 * 测试场景：
 * - User: "你好"
 * - Bot: "你好！有什么我可以帮助你的吗？"
 *
 * 验证：
 * - REST API 返回成功
 * - Agent 返回有意义的回复
 * - 响应时间在合理范围内
 */

import { TestRunner, generateChatId, sleep } from './test-runner.js';

async function main(): Promise<void> {
  const runner = new TestRunner({
    restPort: 3000,
    wsPort: 3001,
    requestTimeout: 60000, // 1 minute for AI response
  });

  runner.startSuite('Use Case 1: 用户发送消息，Agent 回复');

  try {
    await runner.setup();

    // Test 1.1: 简单问候
    await runner.test('简单问候 - "你好"', async () => {
      const chatId = generateChatId();
      const response = await runner.sendChat({
        chatId,
        message: '你好',
        userId: 'test-user-1',
      });

      runner.assert(response.success, 'Response should be successful');
      runner.assertDefined(response.response, 'Response should have content');
      runner.assert(
        response.response!.length > 0,
        'Response should not be empty'
      );

      console.log(`    ${colors.dim}Response: ${response.response?.substring(0, 100)}...${colors.reset}`);
    });

    // Test 1.2: 英文问候
    await runner.test('英文问候 - "Hello"', async () => {
      const chatId = generateChatId();
      const response = await runner.sendChat({
        chatId,
        message: 'Hello',
        userId: 'test-user-1',
      });

      runner.assert(response.success, 'Response should be successful');
      runner.assertDefined(response.response, 'Response should have content');
      runner.assert(
        response.response!.length > 0,
        'Response should not be empty'
      );
    });

    // Test 1.3: 自我介绍
    await runner.test('自我介绍 - "你是谁？"', async () => {
      const chatId = generateChatId();
      const response = await runner.sendChat({
        chatId,
        message: '你是谁？',
        userId: 'test-user-1',
      });

      runner.assert(response.success, 'Response should be successful');
      runner.assertDefined(response.response, 'Response should have content');
      // 应该包含 Claude 或 AI 相关的回答
      const responseText = response.response!.toLowerCase();
      runner.assert(
        responseText.includes('claude') ||
        responseText.includes('ai') ||
        responseText.includes('助手') ||
        responseText.includes('assistant'),
        'Response should identify as an AI assistant'
      );
    });

    // Test 1.4: 表情感知
    await runner.test('表情问候 - "👋"', async () => {
      const chatId = generateChatId();
      const response = await runner.sendChat({
        chatId,
        message: '👋',
        userId: 'test-user-1',
      });

      runner.assert(response.success, 'Response should be successful');
      runner.assertDefined(response.response, 'Response should have content');
    });

  } finally {
    await runner.teardown();
    runner.printSummary();
  }
}

// Colors (duplicated for standalone execution)
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// Run if executed directly
main().catch((error) => {
  console.error(`${colors.red}Test suite failed:${colors.reset}`, error);
  process.exit(1);
});
