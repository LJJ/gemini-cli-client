/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from '../index.js';
import { CoreToolScheduler, CompletedToolCall, ToolCall } from '../core/coreToolScheduler.js';
import { ToolCallRequestInfo } from '../core/turn.js';
import { ApprovalMode } from '../config/config.js';
import express from 'express';
import { StreamingEventService } from './StreamingEventService.js';

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

  public async scheduleToolCall(
    request: ToolCallRequestInfo,
    abortSignal: AbortSignal,
    response: express.Response
  ): Promise<void> {
    if (!this.toolScheduler) {
      throw new Error('Tool scheduler not initialized');
    }

    this.currentResponse = response;

    // 发送工具调用事件
    this.streamingEventService.sendToolCallEvent(
      response,
      request.callId,
      request.name,
      request.args
    );

    // 调度工具执行（不要在这里发送确认事件，让CoreToolScheduler决定）
    await this.toolScheduler.schedule(request, abortSignal);
  }

  public async handleToolConfirmation(
    callId: string,
    outcome: any,
    abortSignal: AbortSignal
  ): Promise<void> {
    if (!this.toolScheduler) {
      throw new Error('Tool scheduler not initialized');
    }

    // 获取工具调用
    const toolCalls = (this.toolScheduler as any).toolCalls;
    const toolCall = toolCalls.find((tc: any) => tc.request.callId === callId);
    
    if (!toolCall || toolCall.status !== 'awaiting_approval') {
      throw new Error('Tool call not found or not awaiting approval');
    }

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
  }

  private handleAllToolCallsComplete(completedCalls: CompletedToolCall[]): void {
    console.log('所有工具调用完成:', completedCalls.length);
    
    if (this.currentResponse) {
      for (const toolCall of completedCalls) {
        this.streamingEventService.sendToolResultEvent(this.currentResponse, toolCall);
      }
    }
  }

  private handleToolCallsUpdate(toolCalls: ToolCall[]): void {
    console.log('工具调用状态更新:', toolCalls.length);
    
    if (this.currentResponse) {
      for (const toolCall of toolCalls) {
        if (toolCall.status === 'awaiting_approval') {
          // 只在工具真正需要确认时才发送确认事件
          this.streamingEventService.sendToolConfirmationEvent(
            this.currentResponse,
            toolCall.request.callId,
            toolCall.request.name,
            typeof toolCall.request.args?.command === 'string' ? toolCall.request.args.command : undefined
          );
        } else if (toolCall.status === 'executing') {
          this.streamingEventService.sendToolExecutionEvent(
            this.currentResponse,
            toolCall.request.callId,
            'executing',
            `正在执行 ${toolCall.request.name}...`
          );
        }
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