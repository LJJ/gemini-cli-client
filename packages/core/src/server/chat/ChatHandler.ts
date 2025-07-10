/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Turn, ServerGeminiStreamEvent, GeminiEventType } from '../../core/turn.js';
import { ToolCallRequestInfo } from '../../core/turn.js';
import express from 'express';
import { StreamingEventService } from './StreamingEventService.js';
import { ToolOrchestrator } from '../tools/ToolOrchestrator.js';
import { ClientManager } from '../core/ClientManager.js';
import { CompletedToolCall } from '../../core/coreToolScheduler.js';

/**
 * 聊天处理器 - 负责聊天消息的处理和流式响应
 * 
 * 职责：
 * - 聊天消息处理
 * - 流式响应管理
 * - 事件分发
 * - Turn 生命周期管理
 * - 工具调用结果处理
 */
export class ChatHandler {
  private currentTurn: Turn | null = null;
  private abortController: AbortController | null = null;
  private pendingToolCalls: Map<string, ToolCallRequestInfo> = new Map();
  private completedToolCalls: CompletedToolCall[] = [];
  private waitingForToolCompletion = false;

  constructor(
    private clientManager: ClientManager,
    private streamingEventService: StreamingEventService,
    private toolOrchestrator: ToolOrchestrator
  ) {}

  public async handleStreamingChat(
    message: string, 
    filePaths: string[] = [],
    res: express.Response
  ): Promise<void> {
    try {
      console.log('=== 开始流式聊天处理 ===');
      
      // 设置流式响应
      this.streamingEventService.setupStreamingResponse(res);

      // 构建完整消息
      const fullMessage = this.buildFullMessage(message, filePaths);
      
      // 获取客户端和配置
      const geminiClient = this.clientManager.getClient();
      const config = this.clientManager.getConfig();
      
      if (!geminiClient || !config) {
        throw new Error('Gemini client not initialized');
      }

      // 初始化工具协调器
      await this.toolOrchestrator.initializeScheduler(config);

      // 设置工具调用完成回调
      this.toolOrchestrator.setToolCompletionCallback(this.handleToolCallsComplete.bind(this));

      // 创建 Turn 和中止信号
      const chat = geminiClient.getChat();
      const prompt_id = config.getSessionId() + '########' + Date.now();
      this.currentTurn = new Turn(chat, prompt_id);
      this.abortController = new AbortController();
      
      // 处理流式响应（可能包含多轮对话）
      await this.processConversationWithTools(fullMessage, res);
      
      // 发送完成事件
      this.streamingEventService.sendCompleteEvent(res);
      res.end();
      
    } catch (error) {
      console.error('Error in handleStreamingChat:', error);
      this.streamingEventService.sendErrorEvent(
        res, 
        error instanceof Error ? error.message : 'Unknown error',
        'STREAM_ERROR',
        error instanceof Error ? error.stack : undefined
      );
      res.end();
    } finally {
      this.toolOrchestrator.clearCurrentResponse();
      this.resetState();
    }
  }

  private async processConversationWithTools(message: string, res: express.Response): Promise<void> {
    const messageParts = [{ text: message }];
    
    // 处理初始消息
    await this.processStreamEvents(messageParts, res);
    
    // 如果有工具调用，等待完成后继续对话
    while (this.waitingForToolCompletion) {
      console.log('等待工具调用完成...');
      await this.waitForToolCompletion();
      
      if (this.completedToolCalls.length > 0) {
        console.log('工具调用完成，发送结果回 Gemini...');
        await this.processToolResults(res);
        this.completedToolCalls = [];
      }
    }
  }

  private async processStreamEvents(messageParts: any[], res: express.Response): Promise<void> {
    if (!this.currentTurn || !this.abortController) {
      throw new Error('Turn or AbortController not initialized');
    }
    
    for await (const event of this.currentTurn.run(messageParts, this.abortController.signal)) {
      console.log('收到事件:', event.type);
      
      switch (event.type) {
        case GeminiEventType.Content:
          this.streamingEventService.sendContentEvent(res, event.value);
          break;
          
        case GeminiEventType.Thought:
          this.streamingEventService.sendThoughtEvent(
            res, 
            event.value.subject, 
            event.value.description
          );
          break;
          
        case GeminiEventType.ToolCallRequest:
          await this.handleToolCallRequest(event.value, res);
          break;
          
        case GeminiEventType.ToolCallResponse:
          console.log('收到工具调用响应:', event.value);
          break;
          
        case GeminiEventType.Error:
          this.streamingEventService.sendErrorEvent(
            res,
            event.value.error.message,
            'GEMINI_ERROR',
            event.value.error.status?.toString()
          );
          break;
          
        case GeminiEventType.UserCancelled:
          this.streamingEventService.sendErrorEvent(res, '操作被取消');
          break;
          
        case GeminiEventType.ChatCompressed:
          console.log('聊天历史被压缩:', event.value);
          break;
      }
    }
  }

  private async handleToolCallRequest(request: ToolCallRequestInfo, res: express.Response): Promise<void> {
    if (!this.abortController) {
      throw new Error('AbortController not initialized');
    }

    console.log('收到工具调用请求:', request);
    
    // 记录待处理的工具调用
    this.pendingToolCalls.set(request.callId, request);
    this.waitingForToolCompletion = true;
    
    await this.toolOrchestrator.scheduleToolCall(
      request,
      this.abortController.signal,
      res
    );
  }

  private async handleToolCallsComplete(completedCalls: CompletedToolCall[]): Promise<void> {
    console.log('ChatHandler: 收到工具调用完成通知', completedCalls.length);
    
    // 保存完成的工具调用
    this.completedToolCalls = completedCalls;
    this.waitingForToolCompletion = false;
    
    // 清理待处理的工具调用
    for (const call of completedCalls) {
      this.pendingToolCalls.delete(call.request.callId);
    }
  }

  private async waitForToolCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        if (!this.waitingForToolCompletion) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
  }

  private async processToolResults(res: express.Response): Promise<void> {
    if (!this.currentTurn || !this.abortController) {
      throw new Error('Turn or AbortController not initialized');
    }

    // 构建工具结果作为新的消息部分
    const toolResultParts = this.completedToolCalls.map(call => {
      if (call.status === 'success' && call.response) {
        return call.response.responseParts;
      } else if (call.status === 'error') {
        return {
          functionResponse: {
            id: call.request.callId,
            name: call.request.name,
            response: { error: call.response?.error?.message || 'Tool execution failed' }
          }
        };
      }
      return null;
    }).filter(Boolean).flat();

    console.log('发送工具结果到 Gemini:', toolResultParts.length, '个部分');

    // 创建新的 Turn 来处理工具结果
    const chat = this.clientManager.getClient()?.getChat();
    const config = this.clientManager.getConfig();
    if (chat && config) {
      const prompt_id = config.getSessionId() + '########' + Date.now();
      this.currentTurn = new Turn(chat, prompt_id);
      
      // 发送工具结果并处理 Gemini 的后续响应
      await this.processStreamEvents(toolResultParts, res);
    }
  }

  private resetState(): void {
    this.pendingToolCalls.clear();
    this.completedToolCalls = [];
    this.waitingForToolCompletion = false;
  }

  private buildFullMessage(message: string, filePaths: string[]): string {
    if (filePaths && filePaths.length > 0) {
      const filePathsText = filePaths.map((p: string) => `@${p}`).join(' ');
      return `${message}\n${filePathsText}`;
    }
    return message;
  }
} 