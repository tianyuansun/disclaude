import { describe, it, expect } from 'vitest';
import { CommandResponseFormatter, type ChannelStatusInfo } from './command-response-formatter.js';
import type { ExecNodeInfo } from '../types/websocket-messages.js';

describe('CommandResponseFormatter', () => {
  const mockExecNodes: ExecNodeInfo[] = [
    {
      nodeId: 'exec-1',
      name: 'Executor 1',
      status: 'connected',
      activeChats: 2,
      connectedAt: new Date('2024-01-01'),
    },
    {
      nodeId: 'exec-2',
      name: 'Executor 2',
      status: 'connected',
      activeChats: 1,
      connectedAt: new Date('2024-01-02'),
    },
  ];

  const mockChannelStatus: ChannelStatusInfo[] = [
    { id: 'feishu', name: 'Feishu', status: 'running' },
    { id: 'rest', name: 'REST', status: 'running' },
  ];

  describe('formatReset', () => {
    it('should return success response with reset message', () => {
      const result = CommandResponseFormatter.formatReset();

      expect(result.success).toBe(true);
      expect(result.message).toContain('对话已重置');
    });
  });

  describe('formatRestart', () => {
    it('should return success response with restart message', () => {
      const result = CommandResponseFormatter.formatRestart();

      expect(result.success).toBe(true);
      expect(result.message).toContain('重启');
    });
  });

  describe('formatStatus', () => {
    it('should format running status', () => {
      const result = CommandResponseFormatter.formatStatus(
        true,
        mockExecNodes,
        mockChannelStatus,
        'exec-1'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Running');
      expect(result.message).toContain('Executor 1');
      expect(result.message).toContain('Feishu');
    });

    it('should format stopped status', () => {
      const result = CommandResponseFormatter.formatStatus(
        false,
        [],
        [],
        undefined
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Stopped');
      expect(result.message).toContain('None');
      expect(result.message).toContain('未分配');
    });

    it('should show current node name', () => {
      const result = CommandResponseFormatter.formatStatus(
        true,
        mockExecNodes,
        mockChannelStatus,
        'exec-1'
      );

      expect(result.message).toContain('Executor 1');
    });
  });

  describe('formatListNodes', () => {
    it('should format nodes list with multiple nodes', () => {
      const result = CommandResponseFormatter.formatListNodes(mockExecNodes, 'exec-1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Executor 1');
      expect(result.message).toContain('Executor 2');
      expect(result.message).toContain('2 活跃会话');
      expect(result.message).toContain('✓ (当前)');
    });

    it('should format empty nodes list', () => {
      const result = CommandResponseFormatter.formatListNodes([], undefined);

      expect(result.success).toBe(true);
      expect(result.message).toContain('暂无连接的执行节点');
    });

    it('should mark current node', () => {
      const result = CommandResponseFormatter.formatListNodes(mockExecNodes, 'exec-2');

      expect(result.message).toContain('✓ (当前)');
      // exec-1 should not be marked as current
      const lines = result.message!.split('\n');
      const exec1Line = lines.find(l => l.includes('Executor 1'));
      expect(exec1Line).not.toContain('✓ (当前)');
    });
  });

  describe('formatSwitchNodeUsage', () => {
    it('should format usage hint with available nodes', () => {
      const result = CommandResponseFormatter.formatSwitchNodeUsage(mockExecNodes);

      expect(result.success).toBe(false);
      expect(result.error).toContain('请指定目标节点ID');
      expect(result.error).toContain('exec-1');
      expect(result.error).toContain('Executor 1');
    });
  });

  describe('formatSwitchNodeSuccess', () => {
    it('should format success message with node name', () => {
      const result = CommandResponseFormatter.formatSwitchNodeSuccess('Executor 1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('已切换执行节点');
      expect(result.message).toContain('Executor 1');
    });
  });

  describe('formatSwitchNodeError', () => {
    it('should format error message with node ID', () => {
      const result = CommandResponseFormatter.formatSwitchNodeError('exec-3');

      expect(result.success).toBe(false);
      expect(result.error).toContain('切换失败');
      expect(result.error).toContain('exec-3');
    });
  });

  describe('formatUnknownCommand', () => {
    it('should format unknown command error', () => {
      const result = CommandResponseFormatter.formatUnknownCommand('foobar');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
      expect(result.error).toContain('foobar');
    });
  });
});
