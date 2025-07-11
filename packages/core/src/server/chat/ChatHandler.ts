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
import { ErrorCode, createError } from '../types/error-codes.js';
import { configFactory } from '../../config/ConfigFactory.js';

/**
 * 聊天处理器 - 负责聊天消息的处理和流式响应（优化版）
 * 
 * 职责：
 * - 聊天消息处理
 * - 流式响应管理
 * - 事件分发
 * - Turn 生命周期管理
 * - 工具调用结果处理
 * 
 * 优化后的特性：
 * - 使用ConfigFactory获取client和config
 * - 适应新的工作区管理模式
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
      
      // 获取客户端和配置 - 使用新的ConfigFactory接口
      const container = configFactory.getCurrentWorkspaceContainer();
      const geminiClient = container.geminiClient;
      const config = container.config;
      
      if (!geminiClient || !config) {
        throw createError(ErrorCode.CLIENT_NOT_INITIALIZED);
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
      const errorCode = error instanceof Error && (error as any).code ? (error as any).code : ErrorCode.STREAM_ERROR;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.streamingEventService.sendErrorEvent(
        res, 
        errorMessage,
        errorCode,
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
    
    // 处理工具调用结果的循环
    await this.processToolCallResults(res);
  }

  private async processToolCallResults(res: express.Response): Promise<void> {
    // 持续检查是否有待处理的工具调用或已完成的工具调用
    while (this.waitingForToolCompletion || this.completedToolCalls.length > 0) {
      // 如果还在等待工具完成，等待一下
      if (this.waitingForToolCompletion && this.completedToolCalls.length === 0) {
        console.log('等待工具调用完成...');
        await this.waitForToolCompletion();
      }
      
      // 处理已完成的工具调用
      if (this.completedToolCalls.length > 0) {
        console.log('工具调用完成，发送结果回 Gemini...');
        await this.processToolResults(res);
        this.completedToolCalls = [];
        // 处理完工具结果后，可能会有新的工具调用，继续循环检查
      }
    }
  }

  private async processStreamEvents(messageParts: any[], res: express.Response): Promise<void> {
    if (!this.currentTurn || !this.abortController) {
      throw createError(ErrorCode.TURN_NOT_INITIALIZED);
    }
    
    // 收集所有工具调用请求，而不是立即处理
    const toolCallRequests: ToolCallRequestInfo[] = [];
    
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
          // 收集工具调用请求而不是立即处理
          console.log('收集工具调用请求:', event.value);
          toolCallRequests.push(event.value);
          break;
          
        case GeminiEventType.ToolCallResponse:
          console.log('收到工具调用响应:', event.value);
          break;
          
        case GeminiEventType.Error:
          this.streamingEventService.sendErrorEvent(
            res,
            event.value.error.message,
            ErrorCode.GEMINI_ERROR,
            event.value.error.status?.toString()
          );
          break;
          
        case GeminiEventType.UserCancelled:
          this.streamingEventService.sendErrorEvent(res, '操作被取消', ErrorCode.INTERNAL_ERROR);
          break;
          
        case GeminiEventType.ChatCompressed:
          console.log('聊天历史被压缩:', event.value);
          break;
      }
    }
    
    // 批量处理所有工具调用请求
    if (toolCallRequests.length > 0) {
      console.log(`批量调度 ${toolCallRequests.length} 个工具调用`);
      await this.handleBatchToolCallRequests(toolCallRequests, res);
    }
  }

  private async handleBatchToolCallRequests(requests: ToolCallRequestInfo[], res: express.Response): Promise<void> {
    if (!this.abortController) {
      throw createError(ErrorCode.ABORT_CONTROLLER_NOT_INITIALIZED);
    }

    console.log('批量处理工具调用请求:', requests.length);
    
    // 记录所有待处理的工具调用
    for (const request of requests) {
      this.pendingToolCalls.set(request.callId, request);
    }
    this.waitingForToolCompletion = true;
    
    // 批量调度所有工具调用
    await this.toolOrchestrator.scheduleToolCalls(
      requests,
      this.abortController.signal,
      res
    );
    
    // 立即检查是否已经有完成的工具调用（针对不需要确认的工具）
    await new Promise(resolve => setTimeout(resolve, 10)); // 给调度一点时间
  }

  private async handleToolCallsComplete(completedCalls: CompletedToolCall[]): Promise<void> {
    console.log('ChatHandler: 收到工具调用完成通知', completedCalls.length);
    
    // 保存完成的工具调用
    this.completedToolCalls = [...this.completedToolCalls, ...completedCalls];
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
      throw createError(ErrorCode.TURN_NOT_INITIALIZED);
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
    }).filter((part): part is any => part !== null).flat();

    // 确保 toolResultParts 是 Part[] 格式
    const parts = toolResultParts.map(part => {
      if (typeof part === 'string') {
        return { text: part };
      }
      return part;
    });

    console.log('发送工具结果到 Gemini:', parts.length, '个部分');

    // 直接将工具结果添加到聊天历史，而不是创建新的 Turn
    const container = configFactory.getCurrentWorkspaceContainer();
    const chat = container.geminiClient?.getChat();
    if (chat) {
      // 将工具结果添加到聊天历史
      chat.addHistory({
        role: 'user',
        parts: parts
      });
      
      // 发送完成事件，结束对话
      this.streamingEventService.sendCompleteEvent(res);
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