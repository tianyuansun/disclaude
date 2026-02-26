---
name: schedule
description: Schedule management specialist. Use when user wants to create, view, modify, or delete schedules. Triggered by keywords like "schedule", "timer", "cron", "定时任务", "提醒", "每天", "每周", "每月", "定期执行". NOT for one-time tasks - use 'task' skill instead.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Schedule Manager

Manage schedules with full CRUD operations.

## 🎯 When to Use This Skill

Use this skill when the user wants:
- **定时任务** (scheduled/recurring tasks)
- **定时执行** (execute at specific times)
- **每天/每周/每月** (daily/weekly/monthly execution)
- **cron 表达式** (cron expressions)
- **提醒/闹钟** (reminders/alarms)
- **timer/计时器** (timers)

## ⚠️ DO NOT Use This Skill For

One-time tasks or general feature requests. Use the **task** skill instead:
- Implement a new feature (one-time)
- Fix a bug (one-time)
- Refactor code (one-time)

## Core Principle

**ALWAYS send feedback to user via `send_user_feedback` after EVERY operation.**

This is mandatory. Users must receive confirmation of operation results.

## Context Variables

When invoked, you receive:
- **Chat ID**: Feishu chat ID (from "**Chat ID:** xxx")
- **Message ID**: Message ID (from "**Message ID:** xxx")
- **Sender Open ID**: Sender's open ID (from "**Sender Open ID:** xxx")

**IMPORTANT**: Use `chatId` as schedule scope to ensure schedules only execute in the correct chat.

## Schedule File Location

Files stored in `workspace/schedules/` as Markdown files.

Filename format: `{name}-{uuid}.md`

---

## CRUD Operations

### 1. Create Schedule

**Steps:**
1. Collect schedule info:
   - Name (short description for filename)
   - Cron expression (cron format or natural language)
   - Content (prompt to execute)

2. Generate unique filename: `{name}-{uuid}.md`

3. Create file with `Write` tool

4. **SEND FEEDBACK** confirming creation

**File Format:**
```markdown
---
name: Schedule Name
cron: "0 9 * * *"
enabled: true
blocking: true
chatId: oc_xxx
createdAt: 2024-01-01T00:00:00.000Z
---

Schedule content prompt here
```

**Field Reference:**
| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | - | Schedule display name |
| `cron` | Yes | - | Cron expression for timing |
| `enabled` | No | `true` | Whether schedule is active |
| `blocking` | No | `true` | Skip execution if previous run still in progress |
| `chatId` | Yes | - | Chat ID for execution context |
| `createdAt` | No | - | Creation timestamp |

---

### 2. List Schedules

**Steps:**
1. Find all schedule files with `Glob`: `workspace/schedules/*.md`
2. Read each file with `Read`
3. Filter by current `chatId`
4. Format and display
5. **SEND FEEDBACK** (even if no schedules found)

**Output Format:**
```
Schedules:

| Name | Cron | Status |
|------|------|--------|
| Daily Report | Daily 9:00 | Enabled |
| Weekly Summary | Fri 14:00 | Disabled |
```

**No Schedules:**
```
No schedules found.
Would you like to create one?
```

---

### 3. Update Schedule

**Modifiable Properties:**
- `cron`: Execution time
- `name`: Schedule name
- `enabled`: Enable/disable
- `blocking`: Blocking mode
- Content (body text)

**Steps:**
1. Find schedule file with `Glob`: `workspace/schedules/*.md`
2. Read and verify `chatId` ownership with `Read`
3. Confirm changes with user
4. Modify with `Edit` tool
5. **SEND FEEDBACK** showing before/after

---

### 4. Disable Schedule (Soft Delete)

**IMPORTANT**: Do NOT delete schedule files. Instead, disable them by setting `enabled: false`.

This preserves the configuration for potential future re-enablement and maintains audit history.

**Steps:**
1. Find schedule files with `Glob`: `workspace/schedules/*.md`
2. Read files with `Read`
3. Filter by current `chatId`
4. Confirm schedule to disable with user
5. Verify schedule belongs to current `chatId`
6. Update `enabled` field to `false` with `Edit` tool
7. **SEND FEEDBACK** confirming disablement

**Example Edit:**
```yaml
# Before
enabled: true

# After
enabled: false
```

**Error Handling:**
- Schedule not found → send feedback with available schedules
- chatId mismatch → reject and explain
- Already disabled → inform user and offer re-enablement

**Re-enable**: Use Update operation to set `enabled: true`

---

## Cron Format

```
minute hour day month weekday
```

**Examples:**
- `"0 9 * * *"` - Daily at 9:00
- `"30 14 * * 5"` - Friday 14:30
- `"0 10 1 * *"` - 1st of month 10:00
- `"*/15 * * * *"` - Every 15 minutes
- `"0 * * * *"` - Hourly
- `"0 0 * * *"` - Daily at midnight

---

## Schedule Prompt Guidelines

When creating or updating schedules, follow these guidelines to ensure efficient execution:

### 1. Be Specific and Actionable
- State exactly what task should be performed
- Avoid vague instructions like "check something"
- Include all necessary context in the prompt

**Good Example:**
```
Execute the automated issue PR workflow:
1. Clone hs3180/disclaude repository
2. Find highest priority open issue without PR
3. Implement the fix
4. Submit a PR with proper description
```

**Bad Example:**
```
Check for issues and fix them
```

### 2. Include Scope Limitations
- Specify file paths, repositories, or services to work with
- Define what NOT to do if relevant
- Set clear boundaries for the task

### 3. Add Execution Constraints
- Use `blocking: true` for tasks that shouldn't overlap
- Consider execution time when setting cron schedules
- Account for potential failures

### 4. Provide Error Handling Guidance
- What to do if the task fails
- Whether to retry or skip
- How to report issues

### 5. Keep Prompts Self-Contained
- All necessary information should be in the prompt
- Don't rely on external context that may change
- Include any required credentials reference (not actual credentials)

### 6. Consider Idempotency
- Design prompts that can be safely re-run
- Avoid creating duplicate resources
- Check for existing state before acting

### 7. Set Appropriate Timing
- Allow enough time for task completion before next run
- Avoid scheduling during peak usage if resource-intensive
- Consider timezone implications

---

## Checklist

After each operation, verify:
- [ ] Used correct `chatId`?
- [ ] Verified schedule ownership?
- [ ] **Sent feedback to user?** (CRITICAL)
- [ ] For new schedules: Prompt follows guidelines?
- [ ] For disable: Used `enabled: false` instead of deleting?

---

## DO NOT

- Create schedules without confirmation
- Modify/disable schedules from other chats
- Complete operation without sending feedback
- Assume directory exists (check first)
- Execute unrelated operations
- **Delete schedule files** (disable with `enabled: false` instead)
- Create schedules with vague prompts
