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
      
      // 立即重置状态，确保每次请求都是干净的开始
      this.resetState();
      
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
    // 当仍有待完成的工具调用或待发送的工具结果时持续循环
    while (this.pendingToolCalls.size > 0 || this.completedToolCalls.length > 0) {
      // 如果仍有未完成的工具调用，等待其全部完成
      if (this.pendingToolCalls.size > 0) {
        console.log('等待所有工具调用完成...');
        await this.waitForToolCompletion();
        continue; // 等待结束后重新检查条件
      }

      // 所有工具调用已完成，批量发送结果
      if (this.completedToolCalls.length > 0) {
        console.log('全部工具调用完成，批量发送结果回 Gemini...');
        await this.processToolResults(res);
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
          // 改进错误日志 - 直接显示完整错误信息
          console.error('❌ Gemini API 错误详情:', JSON.stringify(event.value, null, 2));
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
    console.log('当前已完成工具调用数量:', this.completedToolCalls.length);
    
    // 打印新完成的工具调用详情
    for (const call of completedCalls) {
      console.log(`新完成工具: callId=${call.request.callId}, name=${call.request.name}, status=${call.status}`);
    }
    
    // 增量保存完成的工具调用
    this.completedToolCalls.push(...completedCalls);
    console.log('保存后已完成工具调用数量:', this.completedToolCalls.length);

    // 更新待处理的工具调用集合
    for (const call of completedCalls) {
      this.pendingToolCalls.delete(call.request.callId);
    }

    // 仍有待处理工具则继续等待
    this.waitingForToolCompletion = this.pendingToolCalls.size > 0;
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

    console.log('开始构建工具结果，待处理工具调用:', this.completedToolCalls.length);

    // 关键修复：确保为每个工具调用都构建正确的响应
    const toolResultParts = [];
    
    for (const call of this.completedToolCalls) {
      console.log(`构建工具结果 - callId: ${call.request.callId}, status: ${call.status}`);
      
      if (call.status === 'success' && call.response) {
        // 成功的工具调用
        const responseParts = call.response.responseParts;
        if (Array.isArray(responseParts)) {
          toolResultParts.push(...responseParts);
        } else {
          toolResultParts.push(responseParts);
        }
      } else {
        // 失败的工具调用 - 必须构建错误响应
        const errorResponse = {
          functionResponse: {
            name: call.request.name,
            response: { 
              error: call.response?.error?.message || `Tool execution failed with status: ${call.status}` 
            }
          }
        };
        toolResultParts.push(errorResponse);
        console.log(`为失败的工具调用构建错误响应:`, errorResponse);
      }
    }

    console.log(`发送工具结果到 Gemini: ${toolResultParts.length} 个部分，对应 ${this.completedToolCalls.length} 个工具调用`);

    this.resetState();

    // 关键修复：发送工具结果给Gemini并等待回复，而不是直接结束对话
    try {
      // 处理工具结果的流式响应
      await this.processStreamEvents(toolResultParts, res);
      
      // 继续处理可能的新工具调用
      await this.processToolCallResults(res);
      
    } catch (error) {
      console.error('❌ 处理工具结果时出错:', error);
      
      // 如果是Gemini API错误，尝试提取详细信息
      if (error instanceof Error) {
        console.error('❌ 错误详情:', {
          message: error.message,
          stack: error.stack
        });
      }
      
      this.streamingEventService.sendErrorEvent(
        res,
        error instanceof Error ? error.message : 'Unknown error',
        ErrorCode.STREAM_ERROR
      );
    }

  }

  private resetState(): void {
    console.log('重置ChatHandler状态');
    console.log(`清理前状态: pendingToolCalls=${this.pendingToolCalls.size}, completedToolCalls=${this.completedToolCalls.length}`);
    
    this.pendingToolCalls.clear();
    this.completedToolCalls = [];
    this.waitingForToolCompletion = false;
    
    console.log('状态已重置');
  }

  private buildFullMessage(message: string, filePaths: string[]): string {
    if (filePaths && filePaths.length > 0) {
      const filePathsText = filePaths.map((p: string) => `@${p}`).join(' ');
      return `${message}\n${filePathsText}`;
    }
    return message;
  }
} 