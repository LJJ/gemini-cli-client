/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { ResponseFactory } from '../utils/responseFactory.js';
import { ClientManager } from './ClientManager.js';
import { StreamingEventService } from '../chat/StreamingEventService.js';
import { ToolOrchestrator } from '../tools/ToolOrchestrator.js';
import { ChatHandler } from '../chat/ChatHandler.js';
import { AuthService } from '../auth/AuthService.js';
import { ToolConfirmationRequest } from '../types/api-types.js';
import { ToolConfirmationOutcome } from '../../tools/tools.js';
import { ErrorCode, ERROR_DESCRIPTIONS } from '../types/error-codes.js';

/**
 * Gemini 服务 - 主要协调器
 * 
 * 职责：
 * - 服务组合和协调
 * - HTTP 请求处理
 * - 依赖注入管理
 * - 高级别错误处理
 * - 智能工作目录管理
 */
export class GeminiService {
  private clientManager: ClientManager;
  private streamingEventService: StreamingEventService;
  private toolOrchestrator: ToolOrchestrator;
  private chatHandler: ChatHandler;

  constructor(authService?: AuthService) {
    // 依赖注入 - 组合各个专职服务
    this.clientManager = new ClientManager(authService);
    this.streamingEventService = new StreamingEventService();
    this.toolOrchestrator = new ToolOrchestrator(this.streamingEventService);
    this.chatHandler = new ChatHandler(
      this.clientManager,
      this.streamingEventService,
      this.toolOrchestrator
    );
  }

  public async handleChat(req: express.Request, res: express.Response) {
    try {
      const { message, filePaths = [], workspacePath } = req.body;
      
      if (!message) {
        // 设置流式响应头
        this.streamingEventService.setupStreamingResponse(res);
        // 发送错误事件而不是标准HTTP响应
        this.streamingEventService.sendErrorEvent(res, 'Message is required', ErrorCode.VALIDATION_ERROR);
        this.streamingEventService.sendCompleteEvent(res, false, '请求验证失败');
        res.end();
        return;
      }

      console.log('Processing chat request', { 
        message: message.substring(0, 100),
        filePaths: filePaths.length,
        requestedWorkspace: workspacePath,
        currentWorkspace: this.clientManager.getCurrentWorkspace()
      });

      // 智能初始化客户端（自动检测工作目录变化，子路径优化）
      await this.clientManager.initializeClient(workspacePath);

      // 委托给聊天处理器
      await this.chatHandler.handleStreamingChat(message, filePaths, res);
      
    } catch (error) {
      // 设置流式响应头
      this.streamingEventService.setupStreamingResponse(res);
      // 发送错误事件而不是标准HTTP响应
      const errorCode = error instanceof Error && (error as any).code ? (error as any).code : ErrorCode.INTERNAL_ERROR;
      const errorMessage = error instanceof Error && (error as any).code && Object.values(ErrorCode).includes(errorCode) 
        ? ERROR_DESCRIPTIONS[errorCode as ErrorCode] 
        : (error instanceof Error ? error.message : 'Unknown error');
      this.streamingEventService.sendErrorEvent(
        res, 
        errorMessage,
        errorCode
      );
      this.streamingEventService.sendCompleteEvent(res, false, '处理请求时发生错误');
      res.end();
    }
  }

  public async handleToolConfirmation(req: express.Request, res: express.Response) {
    try {
      const { callId, outcome }: ToolConfirmationRequest = req.body;
      
      // 验证 callId
      if (!callId || typeof callId !== 'string') {
        return res.status(400).json(ResponseFactory.validationError('callId', 'Tool call ID is required and must be a string'));
      }

      // 验证 outcome 枚举值
      const validOutcomes = Object.values(ToolConfirmationOutcome);
      if (!outcome || !validOutcomes.includes(outcome as ToolConfirmationOutcome)) {
        return res.status(400).json(ResponseFactory.validationError('outcome', `Outcome must be one of: ${validOutcomes.join(', ')}`));
      }

      // 委托给工具协调器处理
      const abortController = new AbortController();
      await this.toolOrchestrator.handleToolConfirmation(callId, outcome as ToolConfirmationOutcome, abortController.signal);
      
      res.json(ResponseFactory.success({
        message: this.getOutcomeMessage(outcome as ToolConfirmationOutcome)
      }));
      
    } catch (error) {
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private getOutcomeMessage(outcome: ToolConfirmationOutcome): string {
    switch (outcome) {
      case ToolConfirmationOutcome.ProceedOnce:
        return '工具调用已批准（仅此次）';
      case ToolConfirmationOutcome.ProceedAlways:
        return '工具调用已批准（始终允许）';
      case ToolConfirmationOutcome.ProceedAlwaysServer:
        return '工具调用已批准（始终允许该服务器）';
      case ToolConfirmationOutcome.ProceedAlwaysTool:
        return '工具调用已批准（始终允许该工具）';
      case ToolConfirmationOutcome.ModifyWithEditor:
        return '工具调用将通过编辑器修改';
      case ToolConfirmationOutcome.Cancel:
        return '工具调用已取消';
      default:
        return '工具调用处理完成';
    }
  }

  public getGeminiClient() {
    return this.clientManager.getClient();
  }
} 