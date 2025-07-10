/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { StreamingEventFactory, StreamingEvent } from '../types/streaming-events.js';
import { CompletedToolCall } from '../../core/coreToolScheduler.js';

/**
 * 流式事件服务 - 负责结构化事件的创建和发送
 * 
 * 职责：
 * - 结构化事件创建
 * - 流式响应发送
 * - 事件格式化
 * - 响应头设置
 */
export class StreamingEventService {
  
  public setupStreamingResponse(res: express.Response): void {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // 禁用 Nginx 缓冲
    });
  }

  public sendContentEvent(res: express.Response, text: string, isPartial: boolean = true): void {
    const event = StreamingEventFactory.createContentEvent(text, isPartial);
    this.writeEvent(res, event);
  }

  public sendThoughtEvent(res: express.Response, subject: string, description: string): void {
    const event = StreamingEventFactory.createThoughtEvent(subject, description);
    this.writeEvent(res, event);
  }

  public sendToolCallEvent(
    res: express.Response,
    callId: string,
    name: string,
    args: any,
    requiresConfirmation: boolean = true
  ): void {
    const event = StreamingEventFactory.createToolCallEvent(
      callId,
      name,
      name, // displayName
      `执行工具: ${name}`,
      args,
      requiresConfirmation
    );
    this.writeEvent(res, event);
  }

  public sendToolConfirmationEvent(
    res: express.Response,
    callId: string,
    name: string,
    command?: string
  ): void {
    const event = StreamingEventFactory.createToolConfirmationEvent(
      callId,
      name,
      name, // displayName
      `需要确认工具调用: ${name}`,
      `是否执行工具调用: ${name}`,
      command || undefined
    );
    this.writeEvent(res, event);
  }

  public sendToolExecutionEvent(
    res: express.Response,
    callId: string,
    status: 'pending' | 'executing' | 'completed' | 'failed',
    message: string
  ): void {
    const event = StreamingEventFactory.createToolExecutionEvent(callId, status, message);
    this.writeEvent(res, event);
  }

  public sendToolResultEvent(
    res: express.Response,
    completedCall: CompletedToolCall
  ): void {
    const event = StreamingEventFactory.createToolResultEvent(
      completedCall.request.callId,
      completedCall.request.name,
      this.formatToolResult(completedCall),
      this.formatToolResult(completedCall),
      completedCall.status === 'success',
      completedCall.status === 'error' ? completedCall.response?.error?.message : undefined
    );
    this.writeEvent(res, event);
  }

  public sendCompleteEvent(res: express.Response, success: boolean = true, message: string = '对话完成'): void {
    const event = StreamingEventFactory.createCompleteEvent(success, message);
    this.writeEvent(res, event);
  }

  public sendErrorEvent(res: express.Response, message: string, code?: string, details?: string): void {
    const event = StreamingEventFactory.createErrorEvent(message, code, details);
    this.writeEvent(res, event);
  }

  private writeEvent(res: express.Response, event: StreamingEvent): void {
    const eventJson = JSON.stringify(event) + '\n';
    res.write(eventJson);
  }

  private formatToolResult(completedCall: CompletedToolCall): string {
    if (!completedCall.response) {
      return '工具执行失败';
    }
    
    const toolName = completedCall.request.name;
    
    // 根据工具名称格式化输出
    switch (toolName) {
      case 'read_file':
        return '📄 文件内容已读取';
      case 'list_directory':
        return '📁 目录列表已获取';
      case 'write_file':
        return '✏️ 文件已写入';
      case 'execute_command':
        return '⚡ 命令执行完成';
      default:
        return `🔧 ${toolName} 执行完成`;
    }
  }
} 