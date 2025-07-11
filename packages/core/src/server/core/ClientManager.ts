/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeminiClient } from '../../core/client.js';
import { AuthService } from '../auth/AuthService.js';
import { DEFAULT_GEMINI_FLASH_MODEL } from '../../config/models.js';
import { ErrorCode, createError } from '../types/error-codes.js';
import { configFactory, WorkspaceServiceContainer, FactoryConfigParams } from '../../config/ConfigFactory.js';
import { WorkspaceAwareService } from '../types/service-interfaces.js';
import * as path from 'path';

/**
 * 客户端管理器 - 负责 Gemini 客户端的初始化和管理（优化版）
 * 
 * 职责：
 * - 工作区相关的客户端初始化
 * - 工作目录管理
 * - ConfigFactory 集成
 * - 认证服务访问
 * 
 * 优化后的特性：
 * - AuthService作为全局单例，不随workspace变化
 * - 只重新创建workspace相关的服务
 * - 保持用户认证状态
 * - 智能子路径检查（恢复原始逻辑）
 */
export class ClientManager implements WorkspaceAwareService {
  private currentWorkspacePath: string | null = null;
  private currentContainer: WorkspaceServiceContainer | null = null;

  constructor() {
    // 使用ConfigFactory管理依赖，认证服务全局管理
  }

  /**
   * 获取或创建Gemini客户端
   * @param workspacePath 工作目录路径
   * @param disableCodeAssist 是否禁用CodeAssist
   * @returns GeminiClient实例
   */
  public async getOrCreateClient(workspacePath: string, disableCodeAssist: boolean = false): Promise<GeminiClient> {
    console.log('ClientManager: 获取或创建客户端', { workspacePath, disableCodeAssist });
    
    // 检查是否需要重新初始化工作区
    if (this.needsWorkspaceReinitialization(workspacePath)) {
      console.log('ClientManager: 需要重新初始化工作区');
      await this.initializeWorkspace(workspacePath);
    } else {
      console.log('ClientManager: 复用现有工作区配置');
    }

    // 确保客户端已初始化
    if (!this.currentContainer?.geminiClient) {
      console.log('ClientManager: 初始化GeminiClient');
      await configFactory.initializeGeminiClient(disableCodeAssist);
    }

    return this.currentContainer!.geminiClient!;
    }

  /**
   * 获取AuthService实例（全局单例）
   * @returns AuthService实例
   */
  public getAuthService(): AuthService {
    return configFactory.getAuthService();
  }

  /**
   * 检查是否有活跃的客户端
   * @returns 是否有活跃客户端
   */
  public hasActiveClient(): boolean {
    return this.currentContainer?.geminiClient !== null;
  }

  /**
   * 实现WorkspaceAwareService接口 - 当工作区改变时调用
   */
  public async onWorkspaceChanged(newWorkspacePath: string): Promise<void> {
    console.log('ClientManager: 工作区改变', { 
      from: this.currentWorkspacePath, 
      to: newWorkspacePath 
    });

    if (this.currentWorkspacePath === newWorkspacePath) {
      console.log('ClientManager: 工作区路径未改变，跳过重新初始化');
      return;
    }

    // 重新配置工作区容器（保持AuthService不变）
    await this.initializeWorkspace(newWorkspacePath);
  }

  /**
   * 实现WorkspaceAwareService接口 - 获取当前工作区路径
   */
  public getCurrentWorkspace(): string | null {
    return this.currentWorkspacePath;
  }

  /**
   * 清理当前客户端（只清理工作区相关服务）
   */
  public async cleanup(): Promise<void> {
    console.log('ClientManager: 清理客户端');
    
    if (this.currentContainer) {
      // 清理GeminiClient
      this.currentContainer.geminiClient = null;
      this.currentContainer = null;
  }

    this.currentWorkspacePath = null;
    
    // 清理ConfigFactory的工作区容器（保留AuthService）
    await configFactory.cleanupWorkspaceContainer();
  }

  /**
   * 获取代理配置
   */
  public getProxyConfig(): string | undefined {
    return process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  }

  /**
   * 检查新路径是否为当前workspace的子路径（恢复原始逻辑）
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
   * 检查是否需要重新初始化工作区（恢复子路径检查逻辑）
   */
  private needsWorkspaceReinitialization(workspacePath: string): boolean {
    // 如果没有现有容器，需要初始化
    if (!this.currentContainer) {
      return true;
    }

    // 如果没有当前工作目录，需要初始化
    if (!this.currentWorkspacePath) {
      return true;
    }

    // 如果ConfigFactory未初始化，需要初始化
    if (!configFactory.isFactoryInitialized()) {
      return true;
    }

    // 关键：如果新路径是当前workspace的子路径，不需要重新初始化
    if (this.isSubPath(workspacePath, this.currentWorkspacePath)) {
      console.log('ClientManager: 新路径是当前workspace的子路径，复用现有配置', {
        current: this.currentWorkspacePath,
        requested: workspacePath
      });
      return false;
    }

    // 如果工作区路径发生实质性变化，需要重新初始化
    const normalizedTarget = path.resolve(workspacePath);
    const normalizedCurrent = path.resolve(this.currentWorkspacePath);
    
    const needsReinit = normalizedTarget !== normalizedCurrent;
    
    if (needsReinit) {
      console.log('ClientManager: 工作区发生实质性变化，需要重新初始化', {
        current: normalizedCurrent,
        requested: normalizedTarget
      });
    }

    return needsReinit;
  }

  /**
   * 初始化工作区
   */
  private async initializeWorkspace(workspacePath: string): Promise<void> {
    console.log('ClientManager: 初始化工作区', { workspacePath });

    try {
      // 创建工厂配置参数
      const factoryParams: FactoryConfigParams = {
        targetDir: workspacePath,
        debugMode: false,
        model: DEFAULT_GEMINI_FLASH_MODEL,
        proxy: this.getProxyConfig(),
        cwd: workspacePath,
      };

      // 使用ConfigFactory创建或重新配置工作区容器
      this.currentContainer = await configFactory.createWorkspaceContainer(factoryParams);

      // 更新当前工作区路径
      this.currentWorkspacePath = workspacePath;

      console.log('ClientManager: 工作区初始化完成');
    } catch (error) {
      console.error('ClientManager: 工作区初始化失败:', error);
      throw error;
    }
  }
} 