# Integration Tests

集成测试套件，用于验证 Disclaude 的核心功能。

## 设计原则

1. **不依赖 vitest 框架** - 使用独立的测试脚本
2. **只测试 3 个最常见 use case** - 覆盖核心流程
3. **使用 REST Channel** - 不使用 Feishu channel

## 三个核心 Use Case

### Use Case 1: 用户发送消息，Agent 回复

```
User: "你好"
Bot: "你好！有什么我可以帮助你的吗？"
```

验证：
- REST API 返回成功
- Agent 返回有意义的回复
- 响应时间在合理范围内

### Use Case 2: 用户发送任务，Agent 执行并返回结果

```
User: "帮我分析这个 PR"
Bot: [执行分析] → 返回分析结果
```

验证：
- Agent 能够接收和理解任务
- Agent 能够执行任务
- 返回结构化的结果

### Use Case 3: 多轮对话，保持上下文

```
User: "查看今天的日程"
Bot: "你有 3 个会议..."
User: "第一个会议的详情是什么？"
Bot: [返回第一个会议详情]
```

验证：
- Agent 能够记住之前的对话内容
- Agent 能够理解上下文引用（"第一个"）
- 会话状态正确维护

## 运行测试

### 运行所有测试

```bash
npm run test:integration
```

### 运行快速测试（跳过耗时测试）

```bash
npm run test:integration -- --quick
```

### 显示详细日志

```bash
npm run test:integration -- --verbose
```

### 运行单个测试文件

```bash
# Use Case 1
node --import tsx/esm tests/integration/use-case-1.ts

# Use Case 2
node --import tsx/esm tests/integration/use-case-2.ts

# Use Case 3
node --import tsx/esm tests/integration/use-case-3.ts
```

## 测试框架 API

### TestRunner

```typescript
import { TestRunner, generateChatId } from './test-runner.js';

const runner = new TestRunner({
  restPort: 3000,      // REST API 端口
  wsPort: 3001,        // WebSocket 端口
  requestTimeout: 60000, // 请求超时（毫秒）
});

// 启动测试服务器
await runner.setup();

// 发送聊天消息
const response = await runner.sendChat({
  chatId: generateChatId(),
  message: '你好',
  userId: 'test-user',
});

// 断言
runner.assert(response.success, 'Response should be successful');
runner.assertContains(response.response!, '你好', 'Should contain greeting');

// 停止测试服务器
await runner.teardown();
```

### 断言方法

- `assert(condition, message)` - 断言条件为真
- `assertEqual(actual, expected, message)` - 断言相等
- `assertContains(haystack, needle, message)` - 断言字符串包含
- `assertDefined(value, message)` - 断言值已定义

## 目录结构

```
tests/integration/
├── README.md           # 本文档
├── test-runner.ts      # 测试运行器框架
├── use-case-1.ts       # Use Case 1 测试
├── use-case-2.ts       # Use Case 2 测试
├── use-case-3.ts       # Use Case 3 测试
└── run-all.ts          # 运行所有测试
```

## 注意事项

1. **需要 Claude API 密钥** - 测试需要调用真实的 Claude API
2. **需要足够的时间** - AI 响应可能需要几秒到几分钟
3. **端口占用** - 确保端口 3000-3009 没有被其他服务占用
4. **独立进程** - 每个测试套件启动独立的测试服务器

## 与单元测试的区别

| 特性 | 单元测试 (vitest) | 集成测试 |
|------|-------------------|----------|
| 框架 | vitest | 自定义 TestRunner |
| 范围 | 单个模块/函数 | 完整系统 |
| 外部依赖 | Mock | 真实 API |
| 执行速度 | 快（毫秒级） | 慢（秒到分钟级） |
| 运行频率 | 每次提交 | 手动/CI 定时 |

## 扩展测试

要添加新的测试用例：

1. 在相应的 `use-case-*.ts` 文件中添加新的测试
2. 或创建新的测试文件并导入 `TestRunner`
3. 在 `run-all.ts` 中注册新的测试套件

## 关联

- Issue: #288
- Milestone: 0.3.3
