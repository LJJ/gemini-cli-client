/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { ResponseFactory } from './utils/responseFactory.js';
import { ClientManager } from './ClientManager.js';
import { StreamingEventService } from './StreamingEventService.js';
import { ToolOrchestrator } from './ToolOrchestrator.js';
import { ChatHandler } from './ChatHandler.js';
import { AuthService } from './AuthService.js';

/**
 * Gemini 服务 - 主要协调器
 * 
 * 职责：
 * - 服务组合和协调
 * - HTTP 请求处理
 * - 依赖注入管理
 * - 高级别错误处理
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
        return res.status(400).json(ResponseFactory.validationError('message', 'Message is required'));
      }

      console.log('Processing chat request', { 
        message: message.substring(0, 100),
        filePaths: filePaths.length,
        workspacePath
      });

      // 初始化客户端（如果需要的话）
      await this.clientManager.initializeClient(workspacePath);

      // 委托给聊天处理器
      await this.chatHandler.handleStreamingChat(message, filePaths, res);
      
    } catch (error) {
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public async handleToolConfirmation(req: express.Request, res: express.Response) {
    try {
      const { callId, outcome } = req.body;
      
      if (!callId || !outcome) {
        return res.status(400).json(ResponseFactory.validationError('callId/outcome', 'callId and outcome are required'));
      }

      console.log('处理工具确认:', { callId, outcome });

      // 委托给工具协调器
      await this.toolOrchestrator.handleToolConfirmation(
        callId,
        outcome,
        new AbortController().signal // TODO: 应该从活跃的聊天会话中获取
      );
      
      res.json(ResponseFactory.toolConfirmation('Tool confirmation processed'));
      
    } catch (error) {
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public getGeminiClient() {
    return this.clientManager.getClient();
  }
} 