/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../../index.js';
import { CoreToolScheduler, CompletedToolCall, ToolCall } from '../../core/coreToolScheduler.js';
import { ToolCallRequestInfo } from '../../core/turn.js';
import { ApprovalMode } from '../../config/config.js';
import { ToolConfirmationOutcome } from '../../tools/tools.js';
import express from 'express';
import { StreamingEventService } from '../chat/StreamingEventService.js';

/**
 * 工具协调器 - 负责工具调用的调度和状态管理
 * 
 * 职责：
 * - 工具调度管理
 * - 工具确认处理
 * - 工具状态更新
 * - 与前端事件同步
 */
export class ToolOrchestrator {
  private toolScheduler: CoreToolScheduler | null = null;
  private currentResponse: express.Response | null = null;
  private toolCompletionCallback: ((completedCalls: CompletedToolCall[]) => Promise<void>) | null = null;
  
  // 防止重复发送工具确认事件
  private sentConfirmationEvents: Set<string> = new Set();

  constructor(
    private streamingEventService: StreamingEventService
  ) {}

  public async initializeScheduler(config: Config): Promise<void> {
    const toolRegistry = await config.getToolRegistry();
    
    this.toolScheduler = new CoreToolScheduler({
      toolRegistry: Promise.resolve(toolRegistry),
      onAllToolCallsComplete: this.handleAllToolCallsComplete.bind(this),
      onToolCallsUpdate: this.handleToolCallsUpdate.bind(this),
      outputUpdateHandler: this.handleOutputUpdate.bind(this),
      approvalMode: ApprovalMode.DEFAULT,
      getPreferredEditor: () => 'vscode',
      config
    });
  }

  public setToolCompletionCallback(callback: (completedCalls: CompletedToolCall[]) => Promise<void>): void {
    this.toolCompletionCallback = callback;
  }

  public async scheduleToolCall(
    request: ToolCallRequestInfo,
    abortSignal: AbortSignal,
    response: express.Response
  ): Promise<void> {
    await this.scheduleToolCalls([request], abortSignal, response);
  }

  public async scheduleToolCalls(
    requests: ToolCallRequestInfo[],
    abortSignal: AbortSignal,
    response: express.Response
  ): Promise<void> {
    if (!this.toolScheduler) {
      throw new Error('Tool scheduler not initialized');
    }

    this.currentResponse = response;

    // 为每个工具调用发送工具调用事件
    for (const request of requests) {
      this.streamingEventService.sendToolCallEvent(
        response,
        request.callId,
        request.name,
        request.args
      );
    }

    // 批量调度工具执行
    await this.toolScheduler.schedule(requests, abortSignal);
  }

  public async handleToolConfirmation(
    callId: string,
    outcome: ToolConfirmationOutcome,
    abortSignal: AbortSignal
  ): Promise<void> {
    if (!this.toolScheduler) {
      throw new Error('Tool scheduler not initialized');
    }

    // 验证 outcome 值的有效性
    const validOutcomes = Object.values(ToolConfirmationOutcome);
    if (!validOutcomes.includes(outcome)) {
      throw new Error(`Invalid outcome value: ${outcome}. Must be one of: ${validOutcomes.join(', ')}`);
    }

    // 获取工具调用
    const toolCalls = (this.toolScheduler as any).toolCalls;
    const toolCall = toolCalls.find((tc: any) => tc.request.callId === callId);
    
    if (!toolCall || toolCall.status !== 'awaiting_approval') {
      throw new Error('Tool call not found or not awaiting approval');
    }

    // 记录工具确认决策（用于调试和监控）
    console.log(`工具确认决策: callId=${callId}, toolName=${toolCall.request.name}, outcome=${outcome}`);

    // 使用 CoreToolScheduler 的确认处理
    await this.toolScheduler.handleConfirmationResponse(
      callId,
      toolCall.confirmationDetails.onConfirm,
      outcome,
      abortSignal
    );
  }

  public clearCurrentResponse(): void {
    this.currentResponse = null;
    // 清除已发送的确认事件记录
    this.sentConfirmationEvents.clear();
  }

  public cancelAllOperations(): void {
    console.log('ToolOrchestrator: 取消所有操作');
    
    if (this.toolScheduler) {
      // 取消当前调度器中的所有工具调用
      const toolCalls = (this.toolScheduler as any).toolCalls;
      if (Array.isArray(toolCalls)) {
        for (const toolCall of toolCalls) {
          if (toolCall.status === 'awaiting_approval' || toolCall.status === 'executing') {
            console.log(`取消工具调用: ${toolCall.request.callId}`);
            toolCall.status = 'cancelled';
          }
        }
      }
    }
    
    this.clearCurrentResponse();
  }

  private async handleAllToolCallsComplete(completedCalls: CompletedToolCall[]): Promise<void> {
    console.log('所有工具调用完成:', completedCalls.length);
    
    if (this.currentResponse) {
      for (const toolCall of completedCalls) {
        this.streamingEventService.sendToolResultEvent(this.currentResponse, toolCall);
      }
    }

    // 调用外部回调（如果设置了）
    if (this.toolCompletionCallback) {
      await this.toolCompletionCallback(completedCalls);
    }
  }

  private handleToolCallsUpdate(toolCalls: ToolCall[]): void {
    console.log('工具调用状态更新:', toolCalls.length);
    
    if (this.currentResponse) {
      for (const toolCall of toolCalls) {
        if (toolCall.status === 'awaiting_approval') {
          // 防止重复发送确认事件
          if (!this.sentConfirmationEvents.has(toolCall.request.callId)) {
            console.log('发送工具确认事件:', toolCall.request.callId);
            this.streamingEventService.sendToolConfirmationEvent(
              this.currentResponse,
              toolCall.request.callId,
              toolCall.request.name,
              typeof toolCall.request.args?.command === 'string' ? toolCall.request.args.command : undefined,
              toolCall.request.args
            );
            // 记录已发送的确认事件
            this.sentConfirmationEvents.add(toolCall.request.callId);
          } else {
            console.log('跳过重复的工具确认事件:', toolCall.request.callId);
          }
        } else if (toolCall.status === 'executing') {
          this.streamingEventService.sendToolExecutionEvent(
            this.currentResponse,
            toolCall.request.callId,
            'executing',
            `正在执行 ${toolCall.request.name}...`
          );
        } else if (toolCall.status === 'cancelled') {
          this.streamingEventService.sendToolExecutionEvent(
            this.currentResponse,
            toolCall.request.callId,
            'failed',
            `工具调用已取消: ${toolCall.request.name}`
          );
        } else if (toolCall.status === 'error') {
          this.streamingEventService.sendToolExecutionEvent(
            this.currentResponse,
            toolCall.request.callId,
            'failed',
            `工具调用失败: ${toolCall.request.name}`
          );
        }
        // 注意: success 状态通过 handleAllToolCallsComplete 处理
      }
    }
  }

  private handleOutputUpdate(callId: string, outputChunk: string): void {
    console.log('工具输出更新:', callId, outputChunk);
    
    if (this.currentResponse) {
      this.streamingEventService.sendToolExecutionEvent(
        this.currentResponse,
        callId,
        'executing',
        outputChunk
      );
    }
  }
} 