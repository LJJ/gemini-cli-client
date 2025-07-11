/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config, ConfigParameters } from './config.js';
import { AuthService } from '../server/auth/AuthService.js';
import { GeminiClient } from '../core/client.js';
import { createToolRegistry } from './config.js';
import { DEFAULT_GEMINI_FLASH_MODEL } from './models.js';
import { ErrorCode, createError } from '../server/types/error-codes.js';

/**
 * 工作区相关的服务容器 - 只包含与workspace相关的服务
 */
export interface WorkspaceServiceContainer {
  config: Config;
  geminiClient: GeminiClient | null;
}

/**
 * 工厂配置参数
 */
export interface FactoryConfigParams {
  sessionId?: string;
  targetDir: string;
  debugMode?: boolean;
  model?: string;
  proxy?: string;
  cwd?: string;
}

/**
 * ConfigFactory - 配置和服务的中央工厂（优化版）
 * 
 * 架构优化：
 * 1. AuthService作为全局单例，不随workspace变化
 * 2. 只有workspace相关的服务（Config、GeminiClient）才重新创建
 * 3. 避免因workspace变更导致的认证状态丢失
 * 4. 保持认证状态的持久性
 */
export class ConfigFactory {
  private currentContainer: WorkspaceServiceContainer | null = null;
  private globalAuthService: AuthService | null = null;
  private isInitialized = false;

  /**
   * 获取或创建全局AuthService（单例模式）
   * @returns AuthService实例
   */
  public getOrCreateAuthService(): AuthService {
    if (!this.globalAuthService) {
      console.log('ConfigFactory: 创建全局AuthService单例');
      this.globalAuthService = new AuthService();
    }
    return this.globalAuthService;
  }

  /**
   * 创建或重新创建工作区服务容器
   * @param params 工厂配置参数
   * @returns 工作区服务容器
   */
  public async createWorkspaceContainer(params: FactoryConfigParams): Promise<WorkspaceServiceContainer> {
    console.log('ConfigFactory: 创建工作区服务容器', { targetDir: params.targetDir });

    // 清理现有的工作区容器（但保留AuthService）
    if (this.currentContainer) {
      await this.cleanupWorkspaceContainer();
    }

    // 创建并完整初始化Config对象
    const config = await this.createAndInitializeConfig(params);

    // 确保AuthService已创建并配置新的Config
    const authService = this.getOrCreateAuthService();
    if (authService.isConfigured()) {
      console.log('ConfigFactory: 更新AuthService的Config对象');
      authService.setConfig(config);
    } else {
      console.log('ConfigFactory: 首次为AuthService设置Config对象');
      authService.setConfig(config);
    }

    // 创建工作区服务容器
    const container: WorkspaceServiceContainer = {
      config,
      geminiClient: null, // 延迟创建
    };

    // 缓存容器
    this.currentContainer = container;
    this.isInitialized = true;

    console.log('ConfigFactory: 工作区服务容器创建完成');
    return container;
  }

  /**
   * 重新配置现有容器（用于workspace改变等场景）
   * @param params 新的配置参数
   * @returns 更新后的工作区服务容器
   */
  public async reconfigureWorkspaceContainer(params: FactoryConfigParams): Promise<WorkspaceServiceContainer> {
    console.log('ConfigFactory: 重新配置工作区服务容器', { targetDir: params.targetDir });

    // 检查是否需要重新创建Config（workspace改变）
    const needsRecreate = this.needsWorkspaceRecreation(params);
    
    if (needsRecreate) {
      console.log('ConfigFactory: 检测到workspace改变，重新创建工作区容器');
      return this.createWorkspaceContainer(params);
    }

    // 如果workspace未改变，返回现有容器
    console.log('ConfigFactory: workspace未改变，返回现有容器');
    return this.currentContainer!;
  }

  /**
   * 获取当前的工作区服务容器
   * @returns 工作区服务容器，如果未初始化则抛出错误
   */
  public getCurrentWorkspaceContainer(): WorkspaceServiceContainer {
    if (!this.currentContainer || !this.isInitialized) {
      throw createError(ErrorCode.CLIENT_NOT_INITIALIZED, 'ConfigFactory工作区容器尚未初始化');
    }
    return this.currentContainer;
  }

  /**
   * 获取全局AuthService
   * @returns AuthService实例
   */
  public getAuthService(): AuthService {
    return this.getOrCreateAuthService();
  }

  /**
   * 初始化或重新初始化GeminiClient
   * @param disableCodeAssist 是否禁用CodeAssist
   * @returns GeminiClient实例
   */
  public async initializeGeminiClient(disableCodeAssist: boolean = false): Promise<GeminiClient> {
    const container = this.getCurrentWorkspaceContainer();
    const authService = this.getOrCreateAuthService();
    
    // 检查认证状态
    if (!authService.isUserAuthenticated()) {
      throw createError(ErrorCode.AUTH_REQUIRED, '用户未认证，无法初始化GeminiClient');
    }

    // 创建GeminiClient
    container.geminiClient = new GeminiClient(container.config);

    // 使用智能降级逻辑初始化
    await this.initializeWithFallback(container, authService, disableCodeAssist);

    console.log('ConfigFactory: GeminiClient初始化完成');
    return container.geminiClient;
  }

  /**
   * 检查工厂是否已初始化
   */
  public isFactoryInitialized(): boolean {
    return this.isInitialized && this.currentContainer !== null;
  }

  /**
   * 清理当前容器
   */
  public async cleanup(): Promise<void> {
    console.log('ConfigFactory: 执行完全清理');
    
    // 清理工作区容器
    await this.cleanupWorkspaceContainer();
    
    // 清理全局AuthService
    if (this.globalAuthService) {
      console.log('ConfigFactory: 清理全局AuthService');
      // 这里可以添加AuthService的清理逻辑
      this.globalAuthService = null;
    }
    
    this.isInitialized = false;
  }

  /**
   * 只清理工作区相关的容器（保留AuthService）
   */
  public async cleanupWorkspaceContainer(): Promise<void> {
    if (this.currentContainer) {
      console.log('ConfigFactory: 清理工作区服务容器');
      this.currentContainer.geminiClient = null;
      this.currentContainer = null;
    }
  }

  /**
   * 创建并完整初始化Config对象（遵循原始逻辑）
   */
  private async createAndInitializeConfig(params: FactoryConfigParams): Promise<Config> {
    console.log('ConfigFactory: 创建并初始化Config对象');
    
    const configParams: ConfigParameters = {
      sessionId: params.sessionId || `api-server-${Date.now()}`,
      targetDir: params.targetDir,
      debugMode: params.debugMode || false,
      cwd: params.cwd || params.targetDir,
      model: params.model || DEFAULT_GEMINI_FLASH_MODEL,
      proxy: params.proxy,
    };

    const config = new Config(configParams);
    
    // 关键：立即初始化工具注册表（遵循原始逻辑）
    console.log('ConfigFactory: 初始化工具注册表');
    (config as any).toolRegistry = await createToolRegistry(config);
    
    console.log('ConfigFactory: Config对象初始化完成');
    return config;
  }

  /**
   * 检查是否需要重新创建工作区容器
   */
  private needsWorkspaceRecreation(params: FactoryConfigParams): boolean {
    if (!this.currentContainer) {
      return true;
    }

    // 主要检查targetDir是否改变
    const currentTargetDir = this.currentContainer.config.getTargetDir();
    return currentTargetDir !== params.targetDir;
  }

  /**
   * 使用降级逻辑初始化GeminiClient
   */
  private async initializeWithFallback(
    container: WorkspaceServiceContainer, 
    authService: AuthService, 
    disableCodeAssist: boolean
  ): Promise<void> {
    const geminiClient = container.geminiClient!;
    
    try {
      // 尝试初始化 CodeAssist
      console.log('ConfigFactory: 尝试初始化 CodeAssist...');
      const contentGeneratorConfig = await authService.getContentGeneratorConfig(disableCodeAssist);
      
      // 注意：工具注册表已经在createAndInitializeConfig中初始化了
      await geminiClient.initialize(contentGeneratorConfig);
      console.log('ConfigFactory: CodeAssist 初始化成功');
    } catch (codeAssistError) {
      console.warn('ConfigFactory: CodeAssist 初始化失败，降级到普通 Gemini API:', codeAssistError);
      
      try {
        console.log('ConfigFactory: 尝试使用普通 Gemini API...');
        const fallbackConfig = await authService.getContentGeneratorConfig(true);
        await geminiClient.initialize(fallbackConfig);
        console.log('ConfigFactory: 普通 Gemini API 初始化成功');
      } catch (fallbackError) {
        console.error('ConfigFactory: 普通 Gemini API 也初始化失败:', fallbackError);
        throw createError(ErrorCode.CLIENT_INIT_FAILED, '无法初始化GeminiClient');
      }
    }
  }
}

// 单例实例
export const configFactory = new ConfigFactory(); 