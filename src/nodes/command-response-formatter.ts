/**
 * CommandResponseFormatter - Formats control command responses.
 *
 * This module handles:
 * - Formatting status messages
 * - Formatting node list messages
 * - Formatting switch node messages
 * - All UI formatting logic for control commands
 *
 * Extracted from CommunicationNode for better separation of concerns.
 */

import type { ControlResponse } from '../channels/types.js';
import type { ExecNodeInfo } from '../types/websocket-messages.js';

/**
 * Channel status information for formatting.
 */
export interface ChannelStatusInfo {
  id: string;
  name: string;
  status: string;
}

/**
 * CommandResponseFormatter - Formats control command responses.
 *
 * Features:
 * - Separates UI formatting from business logic
 * - Consistent message format
 * - Localizable responses (future)
 */
export class CommandResponseFormatter {
  /**
   * Format reset command response.
   */
  static formatReset(): ControlResponse {
    return {
      success: true,
      message: '✅ **对话已重置**\n\n新的会话已启动，之前的上下文已清除。',
    };
  }

  /**
   * Format restart command response.
   */
  static formatRestart(): ControlResponse {
    return {
      success: true,
      message: '🔄 **正在重启服务...**',
    };
  }

  /**
   * Format status command response.
   */
  static formatStatus(
    isRunning: boolean,
    execNodes: ExecNodeInfo[],
    channelStatus: ChannelStatusInfo[],
    currentChatNodeId?: string
  ): ControlResponse {
    const status = isRunning ? 'Running' : 'Stopped';
    const execStatus = execNodes.length > 0
      ? execNodes.map(n => `${n.name} (${n.status})`).join(', ')
      : 'None';
    const channelStatusStr = channelStatus
      .map(ch => `${ch.name}: ${ch.status}`)
      .join(', ');
    const currentNode = execNodes.find(n => n.nodeId === currentChatNodeId);

    return {
      success: true,
      message: `📊 **状态**\n\n状态: ${status}\n执行节点: ${execStatus}\n当前节点: ${currentNode?.name || '未分配'}\n通道: ${channelStatusStr}`,
    };
  }

  /**
   * Format list-nodes command response.
   */
  static formatListNodes(
    nodes: ExecNodeInfo[],
    currentChatNodeId?: string
  ): ControlResponse {
    if (nodes.length === 0) {
      return {
        success: true,
        message: '📋 **执行节点列表**\n\n暂无连接的执行节点',
      };
    }

    const nodesList = nodes.map(n => {
      const isCurrent = n.nodeId === currentChatNodeId ? ' ✓ (当前)' : '';
      return `- ${n.name} [${n.status}]${isCurrent} (${n.activeChats} 活跃会话)`;
    }).join('\n');

    return {
      success: true,
      message: `📋 **执行节点列表**\n\n${nodesList}`,
    };
  }

  /**
   * Format switch-node usage hint.
   */
  static formatSwitchNodeUsage(nodes: ExecNodeInfo[]): ControlResponse {
    const nodesList = nodes.map(n => `- \`${n.nodeId}\` (${n.name})`).join('\n');
    return {
      success: false,
      error: `请指定目标节点ID。\n\n可用节点:\n${nodesList}`,
    };
  }

  /**
   * Format successful switch-node response.
   */
  static formatSwitchNodeSuccess(nodeName: string): ControlResponse {
    return {
      success: true,
      message: `✅ **已切换执行节点**\n\n当前节点: ${nodeName}`,
    };
  }

  /**
   * Format failed switch-node response.
   */
  static formatSwitchNodeError(targetNodeId: string): ControlResponse {
    return {
      success: false,
      error: `切换失败，节点 \`${targetNodeId}\` 不可用`,
    };
  }

  /**
   * Format unknown command response.
   */
  static formatUnknownCommand(commandType: string): ControlResponse {
    return {
      success: false,
      error: `Unknown command: ${commandType}`,
    };
  }
}
