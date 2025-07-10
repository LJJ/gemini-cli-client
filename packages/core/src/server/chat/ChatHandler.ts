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

/**
 * 聊天处理器 - 负责聊天消息的处理和流式响应
 * 
 * 职责：
 * - 聊天消息处理
 * - 流式响应管理
 * - 事件分发
 * - Turn 生命周期管理
 */
export class ChatHandler {
  private currentTurn: Turn | null = null;
  private abortController: AbortController | null = null;

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

      // 创建 Turn 和中止信号
      const chat = geminiClient.getChat();
      this.currentTurn = new Turn(chat);
      this.abortController = new AbortController();
      
      // 处理流式响应
      await this.processStreamEvents(fullMessage, res);
      
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
    }
  }

  private async processStreamEvents(message: string, res: express.Response): Promise<void> {
    if (!this.currentTurn || !this.abortController) {
      throw new Error('Turn or AbortController not initialized');
    }

    const messageParts = [{ text: message }];
    
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
    
    await this.toolOrchestrator.scheduleToolCall(
      request,
      this.abortController.signal,
      res
    );
  }

  private buildFullMessage(message: string, filePaths: string[]): string {
    if (filePaths && filePaths.length > 0) {
      const filePathsText = filePaths.map((p: string) => `@${p}`).join(' ');
      return `${message}\n${filePathsText}`;
    }
    return message;
  }
} 