/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config, GeminiClient } from '../index.js';
import { createToolRegistry } from '../config/config.js';
import { AuthService } from './AuthService.js';

/**
 * 客户端管理器 - 负责 Gemini 客户端的初始化和管理
 * 
 * 职责：
 * - Gemini 客户端初始化
 * - 配置管理
 * - 认证处理
 * - CodeAssist 降级逻辑
 */
export class ClientManager {
  private geminiClient: GeminiClient | null = null;
  private config: Config | null = null;
  private authService: AuthService;

  constructor(authService?: AuthService) {
    this.authService = authService || new AuthService();
  }

  public async initializeClient(workspacePath?: string): Promise<GeminiClient> {
    // 重新初始化以确保工作目录正确
    this.geminiClient = null;
    this.config = null;

    try {
      // 创建配置
      const workspaceDir = workspacePath || this.getDefaultWorkspace();
      console.log('Setting workspace directory to:', workspaceDir);
      
      this.config = new Config({
        sessionId: `api-server-${Date.now()}`,
        targetDir: workspaceDir,
        debugMode: false,
        cwd: workspaceDir,
        model: 'gemini-2.5-flash',
        proxy: this.getProxyConfig(),
      });

      // 初始化工具注册表
      (this.config as any).toolRegistry = await createToolRegistry(this.config);

      // 检查认证状态
      if (!this.authService.isUserAuthenticated()) {
        throw new Error('用户未认证，请先完成认证设置');
      }

      // 创建 Gemini 客户端并初始化
      this.geminiClient = new GeminiClient(this.config);
      await this.initializeWithFallback();

      console.log('Gemini client initialized successfully');
      return this.geminiClient;
    } catch (error) {
      console.error('Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  public getClient(): GeminiClient | null {
    return this.geminiClient;
  }

  public getConfig(): Config | null {
    return this.config;
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