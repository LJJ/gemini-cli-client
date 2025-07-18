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
import { ToolConfirmationRequest } from '../types/api-types.js';
import { ToolConfirmationOutcome } from '../../tools/tools.js';
import { ErrorCode } from '../types/error-codes.js';
import { configFactory } from './ConfigFactory.js';
import { DEFAULT_GEMINI_MODEL, DEFAULT_GEMINI_FLASH_MODEL } from '../../config/models.js';
import { WorkspaceService } from '../workspace/WorkspaceService.js';

// 支持的模型列表
const SUPPORTED_MODELS = [
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL
] as const;

/**
 * Gemini 服务 - 主要协调器（优化版）
 * 
 * 职责：
 * - 服务组合和协调
 * - HTTP 请求处理
 * - 依赖注入管理
 * - 高级别错误处理
 * - 智能工作目录管理
 * 
 * 优化后的特性：
 * - 使用ConfigFactory管理依赖
 * - AuthService作为全局单例
 * - 简化的依赖管理
 */
export class GeminiService {
  private clientManager: ClientManager;
  private streamingEventService: StreamingEventService;
  private toolOrchestrator: ToolOrchestrator;
  private chatHandler: ChatHandler;
  private workspaceService: WorkspaceService;

  constructor() {
    // 使用ConfigFactory管理依赖，简化初始化
    this.clientManager = new ClientManager();
    this.streamingEventService = new StreamingEventService();
    this.toolOrchestrator = new ToolOrchestrator(this.streamingEventService);
    this.chatHandler = new ChatHandler(
      this.clientManager,
      this.streamingEventService,
      this.toolOrchestrator
    );
    this.workspaceService = new WorkspaceService(this.clientManager);
  }

  /**
   * 工作区初始化接口 - 委托给WorkspaceService
   */
  public async handleWorkspaceInitialization(req: express.Request, res: express.Response) {
    return this.workspaceService.handleWorkspaceInitialization(req, res);
  }

  /**
   * 工作区状态查询接口 - 委托给WorkspaceService
   */
  public async handleWorkspaceStatus(req: express.Request, res: express.Response) {
    return this.workspaceService.handleWorkspaceStatus(req, res);
  }

  /**
   * 工作区切换接口 - 委托给WorkspaceService
   */
  public async handleWorkspaceSwitch(req: express.Request, res: express.Response) {
    return this.workspaceService.handleWorkspaceSwitch(req, res);
  }

  public async handleChat(req: express.Request, res: express.Response) {
    // 在方法开始时就设置流式响应头，避免后续重复设置
    this.streamingEventService.setupStreamingResponse(res);
    
    try {
      const { message, filePaths = [], workspacePath } = req.body;
      
      // 启动心跳，每6秒发送一次心跳事件
      this.streamingEventService.startHeartBeat(res);
      this.streamingEventService.sendThoughtEvent(res, 'initializing...', 'initializing the workspace');

      if (!message) {
        // 发送错误事件而不是标准HTTP响应
        this.streamingEventService.sendErrorEvent(res, 'Message is required', ErrorCode.VALIDATION_ERROR);
        this.streamingEventService.sendCompleteEvent(res, false, '请求验证失败');
        return;
      }

      // 如果提供了工作区路径，确保客户端已初始化
      if (workspacePath) {
        try {
          await this.workspaceService.ensureWorkspaceInitialized(workspacePath);
        } catch (clientError) {
          // 检查是否是 GOOGLE_CLOUD_PROJECT 错误
          const errorCode = clientError instanceof Error && (clientError as any).code ? (clientError as any).code : ErrorCode.INTERNAL_ERROR;
          const errorMessage = clientError instanceof Error ? clientError.message : 'Unknown error';
          
          this.streamingEventService.sendErrorEvent(res, errorMessage, errorCode);
          this.streamingEventService.sendCompleteEvent(res, false, 'Failed to initialize workspace');
          return;
        }
      } else {
        // 如果没有提供工作区路径，检查是否已有活跃客户端
        const workspaceStatus = this.workspaceService.getWorkspaceStatus();
        if (!workspaceStatus.hasActiveClient) {
          this.streamingEventService.sendErrorEvent(res, 'No active workspace. Please initialize workspace first.', ErrorCode.CLIENT_NOT_INITIALIZED);
          this.streamingEventService.sendCompleteEvent(res, false, '工作区未初始化');
          return;
        }
      }

      const workspaceStatus = this.workspaceService.getWorkspaceStatus();
      console.log('Processing chat request', { 
        message: message.substring(0, 100),
        filePaths: filePaths.length,
        requestedWorkspace: workspacePath || '(当前工作区)',
        currentWorkspace: workspaceStatus.currentWorkspace
      });

      // 委托给聊天处理器
      await this.chatHandler.handleStreamingChat(message, filePaths, res);
      
    } catch (error) {
      console.error('Error in handleChat:', error);
      
      // 发送错误事件而不是标准HTTP响应
      const errorCode = error instanceof Error && (error as any).code ? (error as any).code : ErrorCode.INTERNAL_ERROR;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.streamingEventService.sendErrorEvent(
        res, 
        errorMessage,
        errorCode
      );
      this.streamingEventService.sendCompleteEvent(res, false, '处理请求时发生错误');
    }
  }

  public async handleToolConfirmation(req: express.Request, res: express.Response) {
    try {
      const { callId, outcome } = req.body as ToolConfirmationRequest;

      console.log('Processing tool confirmation request', {
        callId,
        outcome
      });

      if (!callId) {
        return res.status(400).json(ResponseFactory.validationError('callId', 'Tool call ID is required'));
      }

      if (!outcome || !Object.values(ToolConfirmationOutcome).includes(outcome as ToolConfirmationOutcome)) {
        return res.status(400).json(ResponseFactory.validationError('outcome', 'Valid outcome is required'));
      }

      // 检查是否有ConfigFactory初始化
      if (!configFactory.isFactoryInitialized()) {
        return res.status(400).json(ResponseFactory.errorWithCode(ErrorCode.CLIENT_NOT_INITIALIZED, 'System not initialized. Please start a chat first.'));
      }

      // 委托给工具协调器处理
      const abortController = new AbortController();
      await this.toolOrchestrator.handleToolConfirmation(callId, outcome as ToolConfirmationOutcome, abortController.signal);
      
      res.json(ResponseFactory.toolConfirmation('Tool confirmation processed successfully'));
      
    } catch (error) {
      console.error('Error in handleToolConfirmation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json(ResponseFactory.internalError(errorMessage));
    }
  }

  /**
   * 获取系统状态
   */
  public getSystemStatus() {
    const authService = configFactory.getAuthService();
    return {
      configFactory: configFactory.isFactoryInitialized(),
      clientManager: this.clientManager.hasActiveClient(),
      currentWorkspace: this.clientManager.getCurrentWorkspace(),
      authService: {
        configured: authService.isConfigured(),
        authenticated: authService.isUserAuthenticated()
    }
    };
  }

  /**
   * 取消当前聊天
   */
  public async handleCancelChat(res: express.Response) {
    try {
      console.log('Processing chat cancellation request');
      
      // 取消当前聊天处理
      this.chatHandler.cancelCurrentChat();
      
      // 取消工具编排器中的操作
      this.toolOrchestrator.cancelAllOperations();
      
      res.json(ResponseFactory.success({ message: 'Chat cancelled successfully' }));
    } catch (error) {
      console.error('Error in handleCancelChat:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json(ResponseFactory.internalError(errorMessage));
    }
  }

  /**
   * 处理模型状态查询
   */
  public async handleModelStatus(req: express.Request, res: express.Response) {
    try {
      console.log('Processing model status request');

      // 检查是否有ConfigFactory初始化
      if (!configFactory.isFactoryInitialized()) {
        return res.status(400).json(ResponseFactory.errorWithCode(ErrorCode.CLIENT_NOT_INITIALIZED, 'System not initialized. Please start a chat first.'));
      }

      const container = configFactory.getCurrentWorkspaceContainer();
      const config = container.config;
      
      if (!config) {
        return res.status(400).json(ResponseFactory.errorWithCode(ErrorCode.CLIENT_NOT_INITIALIZED, 'Config not initialized.'));
      }

      const currentModel = config.getModel();
      const authService = configFactory.getAuthService();

      // 支持的模型列表
      const supportedModels = [...SUPPORTED_MODELS];

      // 检查所有模型的可用性
      const modelStatuses = await Promise.all(
        supportedModels.map(async (model) => {
          const availability = await this.checkModelAvailability(model, authService);
          return {
            name: model,
            available: availability.available,
            status: availability.status,
            message: availability.message
          };
        })
      );
      
      res.json(ResponseFactory.modelStatus({
        currentModel: currentModel,
        supportedModels: supportedModels,
        modelStatuses: modelStatuses
      }));
      
    } catch (error) {
      console.error('Error in handleModelStatus:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json(ResponseFactory.internalError(errorMessage));
    }
  }

  /**
   * 处理模型切换
   */
  public async handleModelSwitch(req: express.Request, res: express.Response) {
    try {
      const { model } = req.body;
      
      if (!model) {
        return res.status(400).json(ResponseFactory.validationError('model', 'Model name is required'));
      }

      console.log('Processing model switch request', { targetModel: model });

      // 检查是否有ConfigFactory初始化
      if (!configFactory.isFactoryInitialized()) {
        return res.status(400).json(ResponseFactory.validationError('system', 'System not initialized. Please start a chat first.'));
      }

      const container = configFactory.getCurrentWorkspaceContainer();
      const config = container.config;
      
      if (!config) {
        return res.status(400).json(ResponseFactory.validationError('system', 'Config not initialized.'));
      }

      const currentModel = config.getModel();
      
      // 如果模型相同，不需要切换
      if (currentModel === model) {
        return res.json(ResponseFactory.modelSwitch({
          name: model,
          previousModel: currentModel,
          switched: false
        }, `Already using model: ${model}`));
      }

      // 验证模型名称是否有效
      if (!SUPPORTED_MODELS.includes(model as any)) {
        return res.status(400).json(ResponseFactory.validationError('model', 
          `Invalid model name. Valid models: ${SUPPORTED_MODELS.join(', ')}`));
      }

      // 切换模型
      config.setModel(model);
      // 同步ClientManager的模型状态
      this.clientManager.setCurrentModel(model);
      
      // 检查新模型的可用性
      const authService = configFactory.getAuthService();
      const modelAvailability = await this.checkModelAvailability(model, authService);
      
      res.json(ResponseFactory.modelSwitch({
        name: model,
        previousModel: currentModel,
        switched: true,
        available: modelAvailability.available,
        status: modelAvailability.status,
        availabilityMessage: modelAvailability.message
      }, `Model switched successfully from ${currentModel} to ${model}`));
      
    } catch (error) {
      console.error('Error in handleModelSwitch:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json(ResponseFactory.internalError(errorMessage));
    }
  }

  /**
   * 检查模型可用性
   */
  private async checkModelAvailability(model: string, authService: any): Promise<{
    available: boolean;
    status: 'available' | 'unavailable' | 'unknown';
    message: string;
  }> {
    try {
      // Flash模型默认可用
      if (model.includes('flash')) {
        return {
          available: true,
          status: 'available',
          message: 'Flash model is always available'
        };
      }

      // 检查Pro模型的可用性
      if (model.includes('pro')) {
        // 只有在使用API Key认证时才能检查模型可用性
        const contentGeneratorConfig = await authService.getContentGeneratorConfig();
        
        if (contentGeneratorConfig?.apiKey) {
          const { getEffectiveModel } = await import('../../core/modelCheck.js');
          const effectiveModel = await getEffectiveModel(contentGeneratorConfig.apiKey, model);
          
          if (effectiveModel === model) {
            return {
              available: true,
              status: 'available',
              message: 'Pro model is available'
            };
          } else {
            return {
              available: false,
              status: 'unavailable',
              message: 'Pro model is currently rate-limited or unavailable'
            };
          }
        } else {
          return {
            available: true,
            status: 'unknown',
            message: 'Cannot check Pro model availability without API Key (using OAuth)'
          };
        }
      }

      return {
        available: true,
        status: 'unknown',
        message: 'Model availability status unknown'
      };
    } catch (error) {
      console.error('Error checking model availability:', error);
      return {
        available: false,
        status: 'unknown',
        message: 'Error checking model availability'
      };
    }
  }
} 