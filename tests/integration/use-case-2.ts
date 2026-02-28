/**
 * Use Case 2: 用户发送任务，Agent 执行并返回结果
 *
 * 测试场景：
 * - User: "帮我分析这个 PR"
 * - Bot: [执行分析] → 返回分析结果
 *
 * 验证：
 * - Agent 能够接收和理解任务
 * - Agent 能够执行任务
 * - 返回结构化的结果
 */

import { TestRunner, generateChatId } from './test-runner.js';

async function main(): Promise<void> {
  const runner = new TestRunner({
    restPort: 3000,
    wsPort: 3001,
    requestTimeout: 120000, // 2 minutes for task execution
  });

  runner.startSuite('Use Case 2: 用户发送任务，Agent 执行并返回结果');

  try {
    await runner.setup();

    // Test 2.1: 简单计算任务
    await runner.test('简单计算 - "计算 1+1"', async () => {
      const chatId = generateChatId();
      const response = await runner.sendChat({
        chatId,
        message: '计算 1+1 等于多少？',
        userId: 'test-user-2',
      });

      runner.assert(response.success, 'Response should be successful');
      runner.assertDefined(response.response, 'Response should have content');
      runner.assertContains(
        response.response!,
        '2',
        'Response should contain the answer "2"'
      );
    });

    // Test 2.2: 代码生成任务
    await runner.test('代码生成 - "写一个简单的函数"', async () => {
      const chatId = generateChatId();
      const response = await runner.sendChat({
        chatId,
        message: '请写一个 TypeScript 函数，计算两个数的和',
        userId: 'test-user-2',
      });

      runner.assert(response.success, 'Response should be successful');
      runner.assertDefined(response.response, 'Response should have content');

      const responseText = response.response!;
      // 应该包含代码块或函数定义
      runner.assert(
        responseText.includes('function') ||
        responseText.includes('const') ||
        responseText.includes('=>') ||
        responseText.includes('```'),
        'Response should contain code'
      );
    });

    // Test 2.3: 信息查询任务
    await runner.test('信息查询 - "今天日期"', async () => {
      const chatId = generateChatId();
      const response = await runner.sendChat({
        chatId,
        message: '今天是几月几号？',
        userId: 'test-user-2',
      });

      runner.assert(response.success, 'Response should be successful');
      runner.assertDefined(response.response, 'Response should have content');

      // 响应应该包含日期信息
      const responseText = response.response!;
      runner.assert(
        responseText.includes('月') ||
        responseText.includes('日') ||
        responseText.includes('/') ||
        responseText.includes('-') ||
        /\d{4}/.test(responseText), // Contains a year
        'Response should contain date information'
      );
    });

    // Test 2.4: 文本处理任务
    await runner.test('文本处理 - "总结一段文字"', async () => {
      const chatId = generateChatId();
      const longText = `
人工智能（Artificial Intelligence，简称 AI）是计算机科学的一个分支，
致力于创建能够执行通常需要人类智能的任务的系统。这些任务包括学习、
推理、问题解决、感知和语言理解。AI 系统可以通过机器学习、深度学习
等技术从数据中学习，并随着时间的推移改进其性能。
      `.trim();

      const response = await runner.sendChat({
        chatId,
        message: `请用一句话总结这段文字：\n\n${longText}`,
        userId: 'test-user-2',
      });

      runner.assert(response.success, 'Response should be successful');
      runner.assertDefined(response.response, 'Response should have content');

      // 总结应该比原文短
      const summaryLength = response.response!.length;
      const originalLength = longText.length;
      runner.assert(
        summaryLength < originalLength * 2, // 允许一定的扩展，但不应太长
        'Summary should be concise'
      );
    });

    // Test 2.5: 格式化输出任务
    await runner.test('格式化输出 - "生成 JSON"', async () => {
      const chatId = generateChatId();
      const response = await runner.sendChat({
        chatId,
        message: '请生成一个包含 name 和 age 字段的 JSON 对象，name 是 "张三"，age 是 25',
        userId: 'test-user-2',
      });

      runner.assert(response.success, 'Response should be successful');
      runner.assertDefined(response.response, 'Response should have content');

      // 应该包含 JSON 格式的内容
      const responseText = response.response!;
      runner.assert(
        responseText.includes('{') &&
        responseText.includes('}') &&
        responseText.includes('name') &&
        responseText.includes('age'),
        'Response should contain JSON structure'
      );
    });

  } finally {
    await runner.teardown();
    runner.printSummary();
  }
}

// Colors (for standalone execution)
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
