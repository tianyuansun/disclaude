---
name: tool-config
description: Runtime tool configuration manager for managing tool availability. Use when user wants to disable/enable tools, view tool status, or when you discover a tool is unavailable (rate limited, quota exceeded, etc.). Triggered by keywords: "disable tool", "enable tool", "tool config", "工具配置", "禁用工具", "工具不可用".
allowed-tools: Read, Write, Edit, Bash
---

# Tool Configuration Manager

Manage tool availability at runtime with blacklist/whitelist support.

## When to Use This Skill

**✅ Use this skill for:**
- Viewing current tool configuration
- Disabling tools that are unavailable (rate limited, quota exceeded)
- Re-enabling previously disabled tools
- Debugging tool availability issues

**🔄 Automatic Tool Discovery:**
When you encounter tool errors like:
- "Weekly/monthly usage limit"
- "Rate limit exceeded"
- "Tool temporarily unavailable"

You should automatically disable the tool to prevent repeated failures.

## Context Variables

When invoked, you receive:
- **Chat ID**: Feishu chat ID (from "**Chat ID:** xxx")
- **Message ID**: Message ID (from "**Message ID:** xxx")

## Configuration File Location

`workspace/runtime-tool-config.json`

---

## Operations

### 1. View Current Configuration

Read the configuration file to see disabled tools:

```bash
cat workspace/runtime-tool-config.json
```

**Output includes:**
- Global disabled tools
- Per-chat disabled tools
- Disable reasons and timestamps

---

### 2. Disable a Tool

**When to disable:**
- Tool returns quota/limit errors
- Tool is temporarily unavailable
- Tool causes repeated failures

**Method 1: Direct file edit**

```json
{
  "global": {
    "disabled": ["WebSearch", "webReader"],
    "disabledReasons": {
      "WebSearch": "Weekly quota exceeded until March 8, 2026",
      "webReader": "Monthly limit reached"
    },
    "disabledAt": {
      "WebSearch": "2026-02-27T00:00:00.000Z",
      "webReader": "2026-02-27T00:00:00.000Z"
    },
    "enabled": []
  },
  "chats": {}
}
```

**Method 2: Use Write tool to update the file**

1. Read current config
2. Add tool to `disabled` array
3. Add reason to `disabledReasons`
4. Add timestamp to `disabledAt`
5. Write updated config

---

### 3. Enable a Tool

**Remove from disabled list:**

1. Read current config
2. Remove tool from `disabled` array
3. Remove from `disabledReasons`
4. Remove from `disabledAt`
5. Write updated config

---

### 4. Per-Chat Configuration

To disable a tool for a specific chat only:

```json
{
  "global": {
    "disabled": [],
    "disabledReasons": {},
    "disabledAt": {},
    "enabled": []
  },
  "chats": {
    "oc_xxx": {
      "disabled": ["Bash"],
      "disabledReasons": {
        "Bash": "User requested restriction"
      },
      "disabledAt": {
        "Bash": "2026-02-27T00:00:00.000Z"
      },
      "enabled": []
    }
  }
}
```

---

## Automatic Tool Detection

**Pattern Recognition:**

When you see errors like:
```
The search tool has reached its weekly/monthly usage limit
```

**Auto-response:**
1. Disable the tool with the error message as reason
2. Inform user about the disable
3. Suggest alternatives if available

**Example message to user:**
```
⚠️ WebSearch 工具已达到每周配额限制，已自动禁用。
预计恢复时间: March 8, 2026

替代方案:
- 使用 Playwright 浏览器工具进行网页访问
- 请求用户提供相关信息
```

---

## Configuration Structure

```typescript
interface RuntimeToolConfigFile {
  global: {
    disabled: string[];        // Globally disabled tools
    enabled: string[];         // Whitelist (takes precedence)
    disabledReasons: Record<string, string>;  // Why each tool was disabled
    disabledAt: Record<string, string>;       // When each tool was disabled
  };
  chats: Record<string, {      // Per-chatId overrides
    disabled: string[];
    enabled: string[];
    disabledReasons: Record<string, string>;
    disabledAt: Record<string, string>;
  }>;
  updatedAt: string;
}
```

---

## Common Tool Names

| Tool | Description |
|------|-------------|
| `WebSearch` | Web search (often has quota limits) |
| `WebFetch` | Fetch web content |
| `Bash` | Execute shell commands |
| `Read` | Read files |
| `Write` | Write files |
| `Edit` | Edit files |
| `Grep` | Search file contents |
| `Glob` | Find files by pattern |
| `Task` | Launch sub-agents |
| `mcp__*` | MCP tools (e.g., mcp__4_5v_mcp__analyze_image) |

---

## Checklist

After each operation:
- [ ] Read current config before modifying
- [ ] Valid JSON format after edit
- [ ] Include reason when disabling tools
- [ ] Include timestamp when disabling tools
- [ ] Inform user about changes

---

## DO NOT

- Modify config without valid reason
- Disable critical tools (Read, Write) without user consent
- Forget to inform user about tool status changes
- Leave config in invalid JSON state
