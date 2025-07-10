/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { AuthType, createContentGeneratorConfig } from '../../core/contentGenerator.js';
import { ResponseFactory } from '../utils/responseFactory.js';
import { AuthConfigManager } from './AuthConfigManager.js';
import { OAuthManager } from './OAuthManager.js';
import { AuthValidator } from './AuthValidator.js';
import { DEFAULT_GEMINI_FLASH_MODEL } from '../../config/models.js';

/**
 * 认证服务 - 主要协调器
 * 
 * 职责：
 * - 认证流程协调
 * - HTTP请求处理
 * - 认证状态管理
 * - 组件协调
 */
export class AuthService {
  private currentAuthType: AuthType | null = null;
  private currentApiKey: string | null = null;
  private currentGoogleCloudProject: string | null = null;
  private currentGoogleCloudLocation: string | null = null;
  private isAuthenticated = false;

  private configManager: AuthConfigManager;
  private oauthManager: OAuthManager;
  private validator: AuthValidator;

  constructor() {
    // 依赖注入 - 组合专职组件
    this.configManager = new AuthConfigManager();
    this.oauthManager = new OAuthManager();
    this.validator = new AuthValidator();

    // 立即尝试恢复认证状态（修复重启问题）
    this.initializeAuthState();
  }

  /**
   * 初始化认证状态 - 在构造函数中立即调用
   */
  private async initializeAuthState(): Promise<void> {
    try {
      console.log('正在恢复认证状态...');
      
      // 1. 首先尝试从配置文件恢复
      const savedConfig = await this.configManager.loadConfig();
      if (savedConfig) {
        console.log('从配置文件恢复认证状态:', savedConfig.authType);
        
        this.currentAuthType = savedConfig.authType;
        this.currentApiKey = savedConfig.apiKey || null;
        this.currentGoogleCloudProject = savedConfig.googleCloudProject || null;
        this.currentGoogleCloudLocation = savedConfig.googleCloudLocation || null;

        // 验证恢复的认证状态
        if (savedConfig.authType === AuthType.LOGIN_WITH_GOOGLE) {
          // OAuth需要验证凭据
          console.log('开始验证OAuth凭据有效性...');
          this.isAuthenticated = await this.oauthManager.validateCredentials();
          console.log('OAuth凭据验证结果:', this.isAuthenticated ? '成功' : '失败');
          
          if (!this.isAuthenticated) {
            console.log('⚠️ OAuth凭据验证失败，用户需要重新登录');
          } else {
            console.log('✅ OAuth凭据有效，认证状态已恢复');
          }
        } else {
          // API Key认证直接标记为已认证
          this.isAuthenticated = true;
          console.log('✅ API Key认证状态已恢复');
        }
      } else {
        // 2. 如果没有保存的配置，尝试从环境变量加载
        console.log('没有保存的配置，尝试从环境变量加载');
        this.loadFromEnvironment();
      }

      console.log('认证状态初始化完成:', {
        authType: this.currentAuthType,
        isAuthenticated: this.isAuthenticated,
        hasApiKey: !!this.currentApiKey,
        hasGoogleCloudConfig: !!(this.currentGoogleCloudProject && this.currentGoogleCloudLocation)
      });
    } catch (error) {
      console.error('初始化认证状态失败:', error);
      // 初始化失败不应该阻止服务启动
    }
  }

  public async handleAuthConfig(req: express.Request, res: express.Response) {
    try {
      const { authType, apiKey, googleCloudProject, googleCloudLocation } = req.body;

      if (!authType) {
        return res.status(400).json(ResponseFactory.validationError('authType', '认证类型是必需的'));
      }

      // 验证认证方法
      const validationError = this.validator.validateAuthMethod(authType, apiKey, googleCloudProject, googleCloudLocation);
      if (validationError) {
        return res.status(400).json(ResponseFactory.validationError('auth', validationError));
      }

      // 保存认证配置到内存
      this.currentAuthType = authType;
      this.currentApiKey = apiKey || null;
      this.currentGoogleCloudProject = googleCloudProject || null;
      this.currentGoogleCloudLocation = googleCloudLocation || null;

      // 持久化认证配置（修复重启问题）
      await this.configManager.saveConfig({
        authType,
        apiKey,
        googleCloudProject,
        googleCloudLocation
      });

      // 根据认证类型设置状态
      if (authType === AuthType.LOGIN_WITH_GOOGLE) {
        this.isAuthenticated = false; // 需要完成登录流程
      } else {
        this.isAuthenticated = true; // API Key 认证直接完成
      }

      res.json(ResponseFactory.authConfig('认证配置已设置'));

    } catch (error) {
      console.error('Error in handleAuthConfig:', error);
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : '设置认证配置失败'));
    }
  }

  public async handleGoogleLogin(req: express.Request, res: express.Response) {
    try {
      console.log('启动 Google 登录流程');

      if (this.currentAuthType !== AuthType.LOGIN_WITH_GOOGLE) {
        return res.status(400).json({ 
          success: false, 
          message: '当前认证类型不是 Google 登录' 
        });
      }

      try {
        await this.oauthManager.initializeOAuthClient();
        this.isAuthenticated = true;
        
        res.json({
          success: true,
          message: 'Google 登录成功',
          timestamp: new Date().toISOString()
        });
      } catch (oauthError) {
        console.error('Google OAuth 错误:', oauthError);
        
        if (oauthError instanceof Error && this.oauthManager.isNetworkError(oauthError)) {
          res.status(500).json({ 
            success: false,
            message: '网络连接超时或缓存凭据过期，已自动清理缓存。请检查网络连接后重试。',
            error: '网络连接超时或缓存问题'
          });
        } else {
          res.status(500).json({ 
            success: false,
            message: 'Google 登录失败，请检查网络连接或尝试使用 API Key 认证方式',
            error: oauthError instanceof Error ? oauthError.message : 'Unknown error'
          });
        }
      }

    } catch (error) {
      console.error('Error in handleGoogleLogin:', error);
      res.status(500).json({ 
        success: false,
        message: '启动 Google 登录失败',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public async handleAuthStatus(req: express.Request, res: express.Response) {
    try {
      // 如果当前没有认证状态，触发初始化（确保状态最新）
      if (this.currentAuthType === null) {
        await this.initializeAuthState();
      }

      res.json(ResponseFactory.authStatus({
        isAuthenticated: this.isAuthenticated,
        authType: this.currentAuthType,
        hasApiKey: !!this.currentApiKey,
        hasGoogleCloudConfig: !!(this.currentGoogleCloudProject && this.currentGoogleCloudLocation)
      }));
    } catch (error) {
      console.error('Error in handleAuthStatus:', error);
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : '查询认证状态失败'));
    }
  }

  public async handleLogout(req: express.Request, res: express.Response) {
    try {
      console.log('用户登出，清除认证配置');
      
      // 清除内存中的认证信息
      this.clearAuthState();
      
      // 清除持久化的配置
      await this.configManager.clearConfig();
      
      res.json(ResponseFactory.authConfig('登出成功，认证配置已清除'));
    } catch (error) {
      console.error('Error in handleLogout:', error);
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : '登出失败'));
    }
  }

  public async handleClearAuth(req: express.Request, res: express.Response) {
    try {
      console.log('清除认证配置，准备切换认证方式');
      
      // 清除内存中的认证信息
      this.clearAuthState();
      
      // 清除持久化的配置
      await this.configManager.clearConfig();
      
      res.json(ResponseFactory.authConfig('认证配置已清除，可以重新设置认证方式'));
    } catch (error) {
      console.error('Error in handleClearAuth:', error);
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : '清除认证配置失败'));
    }
  }

  public async getContentGeneratorConfig(disableCodeAssist: boolean = false) {
    if (!this.currentAuthType) {
      throw new Error('未设置认证类型');
    }

    const config = await createContentGeneratorConfig(
      DEFAULT_GEMINI_FLASH_MODEL,
      this.currentAuthType
    );

    // 如果禁用 CodeAssist，移除相关配置
    if (disableCodeAssist) {
      console.log('禁用 CodeAssist 配置');
      return {
        ...config,
        codeAssist: undefined
      };
    }

    return config;
  }

  public isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  public getCurrentAuthType(): AuthType | null {
    return this.currentAuthType;
  }

  /**
   * 从环境变量加载认证配置
   */
  private loadFromEnvironment(): void {
    const envConfig = this.validator.loadFromEnvironment();
    
    if (envConfig.authType) {
      this.currentAuthType = envConfig.authType;
      this.currentApiKey = envConfig.apiKey;
      this.currentGoogleCloudProject = envConfig.googleCloudProject;
      this.currentGoogleCloudLocation = envConfig.googleCloudLocation;
      this.isAuthenticated = true;
    }
  }

  /**
   * 清除认证状态
   */
  private clearAuthState(): void {
    this.currentAuthType = null;
    this.currentApiKey = null;
    this.currentGoogleCloudProject = null;
    this.currentGoogleCloudLocation = null;
    this.isAuthenticated = false;
  }
} 