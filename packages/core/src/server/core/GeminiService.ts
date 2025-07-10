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
        return res.status(400).json(ResponseFactory.validationError('message', 'Message is required'));
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
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public async handleToolConfirmation(req: express.Request, res: express.Response) {
    try {
      const { toolCallId, approved } = req.body;
      
      if (!toolCallId || typeof approved !== 'boolean') {
        return res.status(400).json(ResponseFactory.validationError('toolCallId/approved', 'Tool call ID and approval status are required'));
      }

      // 委托给工具协调器处理
      const abortController = new AbortController();
      await this.toolOrchestrator.handleToolConfirmation(toolCallId, approved, abortController.signal);
      
      res.json(ResponseFactory.success({
        message: approved ? '工具调用已批准' : '工具调用已拒绝'
      }));
      
    } catch (error) {
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public getGeminiClient() {
    return this.clientManager.getClient();
  }
} 