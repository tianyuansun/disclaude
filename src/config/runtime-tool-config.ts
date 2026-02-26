/**
 * Runtime Tool Configuration Manager.
 *
 * Provides dynamic tool blacklist/whitelist management at runtime.
 * This allows agents to discover and disable unavailable tools automatically.
 *
 * Key features:
 * - Runtime tool blacklist/whitelist management
 * - Per-chatId configuration support
 * - Persistent storage in workspace
 * - Automatic tool disable on failure detection
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';
import { Config } from './index.js';

const logger = createLogger('RuntimeToolConfig');

/**
 * Tool configuration for a scope (global or per-chatId).
 */
export interface ToolConfig {
  /** Tools that are explicitly disabled (blacklist) */
  disabled: string[];
  /** Tools that are explicitly enabled (whitelist, takes precedence over disabled) */
  enabled: string[];
  /** Reason for disabling each tool */
  disabledReasons: Record<string, string>;
  /** When each tool was disabled */
  disabledAt: Record<string, string>;
}

/**
 * All runtime tool configurations.
 */
export interface RuntimeToolConfigFile {
  /** Global configuration applied to all chats */
  global: ToolConfig;
  /** Per-chatId configurations */
  chats: Record<string, ToolConfig>;
  /** Last modified timestamp */
  updatedAt: string;
}

/**
 * Default empty tool configuration.
 */
const DEFAULT_TOOL_CONFIG: ToolConfig = {
  disabled: [],
  enabled: [],
  disabledReasons: {},
  disabledAt: {},
};

/**
 * Runtime Tool Configuration Manager.
 *
 * Provides dynamic tool management capabilities:
 * - View current tool configuration
 * - Disable/enable tools at runtime
 * - Per-chatId or global scope
 * - Persistent storage
 *
 * @example
 * ```typescript
 * const manager = RuntimeToolConfigManager.getInstance();
 *
 * // Disable a tool globally
 * manager.disableTool('WebSearch', 'Weekly quota exceeded');
 *
 * // Disable for specific chat
 * manager.disableTool('webReader', 'Rate limited', 'oc_xxx');
 *
 * // Check if tool is available
 * const isAvailable = manager.isToolAvailable('WebSearch', 'oc_xxx');
 * ```
 */
export class RuntimeToolConfigManager {
  private static instance: RuntimeToolConfigManager | null = null;
  private config: RuntimeToolConfigFile;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(Config.getWorkspaceDir(), 'runtime-tool-config.json');
    this.config = this.loadConfig();
    logger.info({ configPath: this.configPath }, 'Runtime tool config manager initialized');
  }

  /**
   * Get the singleton instance.
   */
  static getInstance(): RuntimeToolConfigManager {
    if (!RuntimeToolConfigManager.instance) {
      RuntimeToolConfigManager.instance = new RuntimeToolConfigManager();
    }
    return RuntimeToolConfigManager.instance;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    RuntimeToolConfigManager.instance = null;
  }

  /**
   * Reset internal state completely (for testing).
   * Unlike resetInstance(), this keeps the instance but resets all config.
   */
  reset(): void {
    this.config = {
      global: { ...DEFAULT_TOOL_CONFIG },
      chats: {},
      updatedAt: new Date().toISOString(),
    };
    // Also delete the config file
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
      }
    } catch {
      // Ignore errors
    }
    logger.debug('Runtime tool config reset');
  }

  /**
   * Load configuration from file or create default.
   */
  private loadConfig(): RuntimeToolConfigFile {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(content) as RuntimeToolConfigFile;
        logger.debug({ config }, 'Loaded runtime tool config from file');
        return config;
      }
    } catch (error) {
      logger.warn({ err: error }, 'Failed to load runtime tool config, using defaults');
    }

    return {
      global: { ...DEFAULT_TOOL_CONFIG },
      chats: {},
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Save configuration to file.
   */
  private saveConfig(): void {
    try {
      this.config.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.debug({ configPath: this.configPath }, 'Saved runtime tool config');
    } catch (error) {
      logger.error({ err: error }, 'Failed to save runtime tool config');
    }
  }

  /**
   * Get effective tool config for a chatId (merges global + chat-specific).
   */
  getConfig(chatId?: string): ToolConfig {
    const globalConfig = this.config.global;

    if (!chatId) {
      return { ...globalConfig };
    }

    const chatConfig = this.config.chats[chatId];
    if (!chatConfig) {
      return { ...globalConfig };
    }

    // Merge: chat-specific takes precedence
    return {
      disabled: [...new Set([...globalConfig.disabled, ...chatConfig.disabled])],
      enabled: chatConfig.enabled.length > 0 ? chatConfig.enabled : globalConfig.enabled,
      disabledReasons: { ...globalConfig.disabledReasons, ...chatConfig.disabledReasons },
      disabledAt: { ...globalConfig.disabledAt, ...chatConfig.disabledAt },
    };
  }

  /**
   * Check if a tool is available (not in blacklist or in whitelist).
   */
  isToolAvailable(toolName: string, chatId?: string): boolean {
    const config = this.getConfig(chatId);

    // If whitelist is set and tool is in it, it's available
    if (config.enabled.length > 0) {
      return config.enabled.includes(toolName);
    }

    // Otherwise, check if it's in the blacklist
    return !config.disabled.includes(toolName);
  }

  /**
   * Get list of disabled tools for a chatId.
   */
  getDisabledTools(chatId?: string): string[] {
    return this.getConfig(chatId).disabled;
  }

  /**
   * Get list of enabled tools for a chatId (whitelist).
   */
  getEnabledTools(chatId?: string): string[] {
    return this.getConfig(chatId).enabled;
  }

  /**
   * Disable a tool.
   *
   * @param toolName - Tool to disable
   * @param reason - Reason for disabling
   * @param chatId - Optional chatId for per-chat disable, undefined for global
   */
  disableTool(toolName: string, reason: string, chatId?: string): void {
    const target = chatId
      ? (this.config.chats[chatId] ||= { ...DEFAULT_TOOL_CONFIG })
      : this.config.global;

    if (!target.disabled.includes(toolName)) {
      target.disabled.push(toolName);
    }
    target.disabledReasons[toolName] = reason;
    target.disabledAt[toolName] = new Date().toISOString();

    // Remove from enabled if present
    target.enabled = target.enabled.filter((t) => t !== toolName);

    this.saveConfig();
    logger.info({ toolName, reason, chatId: chatId || 'global' }, 'Tool disabled');
  }

  /**
   * Enable a tool (removes from disabled list, optionally adds to enabled list).
   *
   * @param toolName - Tool to enable
   * @param chatId - Optional chatId for per-chat enable
   * @param addToWhitelist - If true, adds to whitelist instead of just removing from blacklist
   */
  enableTool(toolName: string, chatId?: string, addToWhitelist = false): void {
    const target = chatId
      ? (this.config.chats[chatId] ||= { ...DEFAULT_TOOL_CONFIG })
      : this.config.global;

    // Remove from disabled
    target.disabled = target.disabled.filter((t) => t !== toolName);
    delete target.disabledReasons[toolName];
    delete target.disabledAt[toolName];

    if (addToWhitelist && !target.enabled.includes(toolName)) {
      target.enabled.push(toolName);
    }

    this.saveConfig();
    logger.info({ toolName, chatId: chatId || 'global', addToWhitelist }, 'Tool enabled');
  }

  /**
   * Clear all tool configurations for a chatId.
   */
  clearChatConfig(chatId: string): void {
    delete this.config.chats[chatId];
    this.saveConfig();
    logger.info({ chatId }, 'Chat tool config cleared');
  }

  /**
   * Get disabled tool info (reason and when it was disabled).
   */
  getToolDisableInfo(toolName: string, chatId?: string): { reason: string; disabledAt: string } | null {
    const config = this.getConfig(chatId);
    if (!config.disabled.includes(toolName)) {
      return null;
    }
    return {
      reason: config.disabledReasons[toolName] || 'No reason provided',
      disabledAt: config.disabledAt[toolName] || 'Unknown',
    };
  }

  /**
   * Get full configuration for debugging.
   */
  getFullConfig(): RuntimeToolConfigFile {
    return JSON.parse(JSON.stringify(this.config));
  }
}

// Export singleton getter for convenience
export const getRuntimeToolConfig = () => RuntimeToolConfigManager.getInstance();
