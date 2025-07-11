/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config, GeminiClient } from '../../index.js';
import { createToolRegistry } from '../../config/config.js';
import { AuthService } from '../auth/AuthService.js';
import { DEFAULT_GEMINI_FLASH_MODEL } from '../../config/models.js';
import * as path from 'path';

/**
 * 客户端管理器 - 负责 Gemini 客户端的初始化和管理
 * 
 * 职责：
 * - Gemini 客户端初始化
 * - 配置管理
 * - 认证处理
 * - CodeAssist 降级逻辑
 * - 智能工作目录管理
 */
export class ClientManager {
  private geminiClient: GeminiClient | null = null;
  private config: Config | null = null;
  private authService: AuthService;
  private currentWorkspacePath: string | null = null;

  constructor(authService?: AuthService) {
    this.authService = authService || new AuthService();
  }

  public async initializeClient(workspacePath?: string): Promise<GeminiClient> {
    const targetWorkspacePath = workspacePath || this.getDefaultWorkspace();
    
    // 智能检查是否需要重新初始化
    if (this.shouldReinitialize(targetWorkspacePath)) {
      const reason = this.getReinitializationReason(targetWorkspacePath);
      console.log(`工作目录管理: ${reason}`);
      await this.reinitializeClient(targetWorkspacePath);
    } else {
      console.log(`工作目录管理: 使用现有客户端 (${targetWorkspacePath})`);
      return this.geminiClient!;
    }

    return this.geminiClient!;
  }
  /**
   * 获取当前工作目录
   */
  public getCurrentWorkspace(): string | null {
    return this.currentWorkspacePath;
  }

  /**
   * 检查客户端是否已初始化
   */
  public isInitialized(): boolean {
    return this.geminiClient !== null && this.config !== null;
  }

  public getClient(): GeminiClient | null {
    return this.geminiClient;
  }

  public getConfig(): Config | null {
    return this.config;
  }

  /**
   * 检查新路径是否为当前workspace的子路径
   */
  private isSubPath(newPath: string, currentPath: string): boolean {
    if (!currentPath || !newPath) return false;
    
    const normalizedNew = path.resolve(newPath);
    const normalizedCurrent = path.resolve(currentPath);
    
    // 如果路径相同，认为是同一路径
    if (normalizedNew === normalizedCurrent) return true;
    
    // 检查新路径是否为当前路径的子路径
    const relativePath = path.relative(normalizedCurrent, normalizedNew);
    
    // 如果relative path不以'..'开头且不是空字符串，说明是子路径
    return relativePath.length > 0 && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
  }

  /**
   * 检查是否需要重新初始化
   */
  private shouldReinitialize(targetWorkspacePath: string): boolean {
    // 如果客户端未初始化，需要初始化
    if (!this.geminiClient || !this.config) {
      return true;
    }

    // 如果没有当前工作目录，需要初始化
    if (!this.currentWorkspacePath) {
      return true;
    }

    // 如果新路径是当前workspace的子路径，不需要重新初始化
    if (this.isSubPath(targetWorkspacePath, this.currentWorkspacePath)) {
      return false;
    }

    // 如果工作目录发生实质性变化，需要重新初始化
    const normalizedTarget = path.resolve(targetWorkspacePath);
    const normalizedCurrent = path.resolve(this.currentWorkspacePath);
    
    return normalizedTarget !== normalizedCurrent;
  }

  /**
   * 获取重新初始化的原因（用于日志）
   */
  private getReinitializationReason(targetWorkspacePath: string): string {
    if (!this.geminiClient || !this.config) {
      return `首次初始化客户端 (${targetWorkspacePath})`;
    }

    if (!this.currentWorkspacePath) {
      return `设置工作目录 (${targetWorkspacePath})`;
    }

    return `工作目录变化 (${this.currentWorkspacePath} -> ${targetWorkspacePath})`;
  }

  /**
   * 重新初始化客户端
   */
  private async reinitializeClient(workspacePath: string): Promise<GeminiClient> {
    try {
      // 清理旧的客户端
      this.geminiClient = null;
      this.config = null;

      // 创建新配置
      console.log('Setting workspace directory to:', workspacePath);
      
      this.config = new Config({
        sessionId: `api-server-${Date.now()}`,
        targetDir: workspacePath,
        debugMode: false,
        cwd: workspacePath,
        model: DEFAULT_GEMINI_FLASH_MODEL,
        proxy: this.getProxyConfig(),
      });

      // 设置 AuthService 的配置对象
      this.authService.setConfig(this.config);

      // 初始化工具注册表
      (this.config as any).toolRegistry = await createToolRegistry(this.config);

      // 检查认证状态
      if (!this.authService.isUserAuthenticated()) {
        throw new Error('用户未认证，请先完成认证设置');
      }

      // 创建 Gemini 客户端并初始化
      this.geminiClient = new GeminiClient(this.config);
      await this.initializeWithFallback();

      // 更新当前工作目录
      this.currentWorkspacePath = workspacePath;

      console.log('Gemini client initialized successfully');
      return this.geminiClient;
    } catch (error) {
      console.error('Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  private async initializeWithFallback(): Promise<void> {
    try {
      // 尝试初始化 CodeAssist
      console.log('尝试初始化 CodeAssist...');
      const contentGeneratorConfig = await this.authService.getContentGeneratorConfig();
      await this.geminiClient!.initialize(contentGeneratorConfig);
      console.log('CodeAssist 初始化成功');
    } catch (codeAssistError) {
      console.warn('CodeAssist 初始化失败，降级到普通 Gemini API:', codeAssistError);
      
      try {
        console.log('尝试使用普通 Gemini API...');
        const fallbackConfig = await this.authService.getContentGeneratorConfig(true);
        await this.geminiClient!.initialize(fallbackConfig);
        console.log('普通 Gemini API 初始化成功');
      } catch (fallbackError) {
        console.error('普通 Gemini API 也初始化失败:', fallbackError);
        throw new Error(`Gemini 客户端初始化失败: ${fallbackError instanceof Error ? fallbackError.message : '未知错误'}`);
      }
    }
  }

  private getDefaultWorkspace(): string {
    return process.env.GEMINI_WORKSPACE || process.env.HOME || '/Users/libmac';
  }

  private getProxyConfig(): string | undefined {
    return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  }
} 