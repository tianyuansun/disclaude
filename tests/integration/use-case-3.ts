/**
 * Use Case 3: 多轮对话，保持上下文
 *
 * 测试场景：
 * - User: "查看今天的日程"
 * - Bot: "你有 3 个会议..."
 * - User: "第一个会议的详情是什么？"
 * - Bot: [返回第一个会议详情]
 *
 * 验证：
 * - Agent 能够记住之前的对话内容
 * - Agent 能够理解上下文引用（"第一个"）
 * - 会话状态正确维护
 */

import { TestRunner, generateChatId, sleep } from './test-runner.js';

async function main(): Promise<void> {
  const runner = new TestRunner({
    restPort: 3000,
    wsPort: 3001,
    requestTimeout: 120000, // 2 minutes for task execution
  });

  runner.startSuite('Use Case 3: 多轮对话，保持上下文');

  try {
    await runner.setup();

    // Test 3.1: 简单上下文记忆
    await runner.test('上下文记忆 - 记住名字', async () => {
      const chatId = generateChatId();

      // 第一轮：告诉名字
      const response1 = await runner.sendChat({
        chatId,
        message: '你好，我叫小明',
        userId: 'test-user-3',
      });

      runner.assert(response1.success, 'First response should be successful');

      // 第二轮：询问名字
      const response2 = await runner.sendChat({
        chatId,
        message: '你还记得我的名字吗？',
        userId: 'test-user-3',
      });

      runner.assert(response2.success, 'Second response should be successful');
      runner.assertDefined(response2.response, 'Response should have content');

      // 应该记得名字是"小明"
      runner.assertContains(
        response2.response!,
        '小明',
        'Agent should remember the name "小明"'
      );
    });

    // Test 3.2: 数字序列上下文
    await runner.test('上下文记忆 - 数字序列', async () => {
      const chatId = generateChatId();

      // 第一轮：给出一个数字
      const response1 = await runner.sendChat({
        chatId,
        message: '记住这个数字：42',
        userId: 'test-user-3',
      });

      runner.assert(response1.success, 'First response should be successful');

      // 第二轮：询问数字
      const response2 = await runner.sendChat({
        chatId,
        message: '我刚才让你记住的数字是多少？',
        userId: 'test-user-3',
      });

      runner.assert(response2.success, 'Second response should be successful');
      runner.assertDefined(response2.response, 'Response should have content');

      // 应该记得数字是 42
      runner.assertContains(
        response2.response!,
        '42',
        'Agent should remember the number "42"'
      );
    });

    // Test 3.3: 偏好记忆
    await runner.test('上下文记忆 - 语言偏好', async () => {
      const chatId = generateChatId();

      // 第一轮：设置偏好
      const response1 = await runner.sendChat({
        chatId,
        message: '从现在开始，请用中文回答我的问题',
        userId: 'test-user-3',
      });

      runner.assert(response1.success, 'First response should be successful');

      // 第二轮：用英文提问（应该用中文回答）
      const response2 = await runner.sendChat({
        chatId,
        message: 'What is the capital of France?',
        userId: 'test-user-3',
      });

      runner.assert(response2.success, 'Second response should be successful');
      runner.assertDefined(response2.response, 'Response should have content');

      // 响应应该包含中文内容（巴黎）
      const responseText = response2.response!;
      runner.assert(
        responseText.includes('巴黎') || responseText.includes('Paris'),
        'Response should mention Paris'
      );
    });

    // Test 3.4: 计算上下文
    await runner.test('上下文记忆 - 连续计算', async () => {
      const chatId = generateChatId();

      // 第一轮：初始计算
      const response1 = await runner.sendChat({
        chatId,
        message: '计算 10 + 5',
        userId: 'test-user-3',
      });

      runner.assert(response1.success, 'First response should be successful');
      runner.assertContains(response1.response!, '15', '10 + 5 should equal 15');

      // 第二轮：基于上一次结果计算
      const response2 = await runner.sendChat({
        chatId,
        message: '把结果乘以 2',
        userId: 'test-user-3',
      });

      runner.assert(response2.success, 'Second response should be successful');
      runner.assertDefined(response2.response, 'Response should have content');

      // 应该计算 15 * 2 = 30
      runner.assertContains(
        response2.response!,
        '30',
        '15 * 2 should equal 30'
      );
    });

    // Test 3.5: 不同会话隔离
    await runner.test('会话隔离 - 不同 chatId 隔离', async () => {
      const chatId1 = generateChatId();
      const chatId2 = generateChatId();

      // 在会话1中设置信息
      const response1 = await runner.sendChat({
        chatId: chatId1,
        message: '我的名字是张三',
        userId: 'test-user-3a',
      });

      runner.assert(response1.success, 'Chat 1 first response should be successful');

      // 在会话2中询问（应该不知道）
      const response2 = await runner.sendChat({
        chatId: chatId2,
        message: '你知道我的名字吗？',
        userId: 'test-user-3b',
      });

      runner.assert(response2.success, 'Chat 2 response should be successful');
      runner.assertDefined(response2.response, 'Response should have content');

      // 会话2不应该知道"张三"
      const response2Text = response2.response!;
      runner.assert(
        !response2Text.includes('张三'),
        'Chat 2 should not know the name from Chat 1'
      );
    });

    // Test 3.6: 长对话上下文
    await runner.test('上下文记忆 - 三轮对话', async () => {
      const chatId = generateChatId();

      // 第一轮
      const response1 = await runner.sendChat({
        chatId,
        message: '我最喜欢的颜色是蓝色',
        userId: 'test-user-3',
      });
      runner.assert(response1.success, 'Round 1 should be successful');

      // 第二轮
      const response2 = await runner.sendChat({
        chatId,
        message: '我最喜欢的水果是苹果',
        userId: 'test-user-3',
      });
      runner.assert(response2.success, 'Round 2 should be successful');

      // 第三轮：询问两个信息
      const response3 = await runner.sendChat({
        chatId,
        message: '我最喜欢的颜色和水果分别是什么？',
        userId: 'test-user-3',
      });

      runner.assert(response3.success, 'Round 3 should be successful');
      runner.assertDefined(response3.response, 'Response should have content');

      const response3Text = response3.response!;
      // 应该记得两个信息
      runner.assert(
        response3Text.includes('蓝') || response3Text.toLowerCase().includes('blue'),
        'Agent should remember the favorite color is blue'
      );
      runner.assert(
        response3Text.includes('苹果') || response3Text.toLowerCase().includes('apple'),
        'Agent should remember the favorite fruit is apple'
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
