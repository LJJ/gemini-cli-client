/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { AuthType, createContentGeneratorConfig } from '../core/contentGenerator.js';
import { getOauthClient, clearCachedCredentialFile } from '../code_assist/oauth2.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { ResponseFactory } from './utils/responseFactory.js';

export class AuthService {
  private currentAuthType: AuthType | null = null;
  private currentApiKey: string | null = null;
  private currentGoogleCloudProject: string | null = null;
  private currentGoogleCloudLocation: string | null = null;
  private isAuthenticated = false;
  private readonly userAuthConfigPath: string;

  constructor() {
    // 初始化用户认证配置文件路径
    this.userAuthConfigPath = path.join(os.homedir(), '.gemini', 'user_auth_config.json');
    
    // 初始化时不自动加载环境变量，等待客户端设置认证方式
    // 只有在没有客户端设置时才使用环境变量作为后备
  }

  /**
   * 保存用户的认证选择到本地文件
   */
  private async saveUserAuthChoice(authType: AuthType): Promise<void> {
    try {
      // 确保目录存在
      const configDir = path.dirname(this.userAuthConfigPath);
      await fs.mkdir(configDir, { recursive: true });
      
      const config = {
        authType,
        timestamp: new Date().toISOString()
      };
      
      await fs.writeFile(this.userAuthConfigPath, JSON.stringify(config, null, 2));
      console.log('用户认证选择已保存:', authType);
    } catch (error) {
      console.error('保存用户认证选择失败:', error);
    }
  }

  /**
   * 加载用户之前的认证选择
   */
  private async loadUserAuthChoice(): Promise<AuthType | null> {
    try {
      const configData = await fs.readFile(this.userAuthConfigPath, 'utf-8');
      const config = JSON.parse(configData);
      
      if (config.authType && Object.values(AuthType).includes(config.authType)) {
        console.log('加载用户之前的认证选择:', config.authType);
        return config.authType;
      }
    } catch (error) {
      // 文件不存在或格式错误，忽略
      console.log('没有找到用户之前的认证选择');
    }
    return null;
  }

  private loadFromEnvironment() {
    // 只有在当前没有设置认证类型时才从环境变量加载
    if (this.currentAuthType !== null) {
      return; // 客户端已经设置了认证方式，不覆盖
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
    const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION;

    if (geminiApiKey) {
      this.currentAuthType = AuthType.USE_GEMINI;
      this.currentApiKey = geminiApiKey;
      this.isAuthenticated = true;
      console.log('从环境变量加载 Gemini API Key 认证');
    } else if (googleApiKey && googleCloudProject && googleCloudLocation) {
      this.currentAuthType = AuthType.USE_VERTEX_AI;
      this.currentApiKey = googleApiKey;
      this.currentGoogleCloudProject = googleCloudProject;
      this.currentGoogleCloudLocation = googleCloudLocation;
      this.isAuthenticated = true;
      console.log('从环境变量加载 Google Cloud 认证');
    }
  }

  /**
   * 检查并清理过期的OAuth缓存凭据
   */
  private async checkAndCleanExpiredCredentials(): Promise<boolean> {
    try {
      const geminiDir = path.join(os.homedir(), '.gemini');
      const oauthCredsPath = path.join(geminiDir, 'oauth_creds.json');
      
      // 检查凭据文件是否存在
      try {
        await fs.access(oauthCredsPath);
      } catch {
        // 文件不存在，无需清理
        return false;
      }

      // 读取凭据文件
      const credsData = await fs.readFile(oauthCredsPath, 'utf-8');
      const creds = JSON.parse(credsData);

      // 检查是否有过期时间
      if (creds.expiry_date) {
        const expiryDate = new Date(creds.expiry_date);
        const now = new Date();
        
        // 如果凭据已过期或即将过期（5分钟内），清理缓存
        if (expiryDate <= now || (expiryDate.getTime() - now.getTime()) < 5 * 60 * 1000) {
          console.log('检测到过期的OAuth凭据，正在清理...');
          await clearCachedCredentialFile();
          return true;
        }
      }

      // 检查access_token是否存在
      if (!creds.access_token) {
        console.log('检测到无效的OAuth凭据（缺少access_token），正在清理...');
        await clearCachedCredentialFile();
        return true;
      }

      // 检查refresh_token是否存在（对于长期认证很重要）
      if (!creds.refresh_token) {
        console.log('检测到缺少refresh_token的OAuth凭据，正在清理...');
        await clearCachedCredentialFile();
        return true;
      }

      // 检查凭据文件是否损坏（JSON格式错误等）
      if (typeof creds !== 'object' || creds === null) {
        console.log('检测到损坏的OAuth凭据文件，正在清理...');
        await clearCachedCredentialFile();
        return true;
      }

      return false;
    } catch (error) {
      console.error('检查OAuth凭据时出错:', error);
      // 如果检查过程中出错，为了安全起见，清理缓存
      try {
        await clearCachedCredentialFile();
        return true;
      } catch (cleanupError) {
        console.error('清理OAuth凭据时出错:', cleanupError);
        return false;
      }
    }
  }

  public async handleAuthConfig(req: express.Request, res: express.Response) {
    try {
      const { authType, apiKey, googleCloudProject, googleCloudLocation } = req.body;

      if (!authType) {
        return res.status(400).json(ResponseFactory.validationError('authType', '认证类型是必需的'));
      }

      console.log('设置认证配置:', { authType, hasApiKey: !!apiKey, googleCloudProject, googleCloudLocation });

      // 验证认证方法
      const validationError = this.validateAuthMethod(authType, apiKey, googleCloudProject, googleCloudLocation);
      if (validationError) {
        return res.status(400).json(ResponseFactory.validationError('auth', validationError));
      }

      // 保存认证配置
      this.currentAuthType = authType;
      this.currentApiKey = apiKey || null;
      this.currentGoogleCloudProject = googleCloudProject || null;
      this.currentGoogleCloudLocation = googleCloudLocation || null;

      // 保存用户的选择
      await this.saveUserAuthChoice(authType);

      // 根据认证类型处理
      if (authType === AuthType.LOGIN_WITH_GOOGLE) {
        // Google 登录需要特殊处理
        this.isAuthenticated = false; // 需要完成登录流程
      } else {
        // API Key 认证直接完成
        this.isAuthenticated = true;
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

      // 在启动OAuth流程前，检查并清理过期的缓存凭据
      const wasCleaned = await this.checkAndCleanExpiredCredentials();
      if (wasCleaned) {
        console.log('已清理过期的OAuth凭据，将重新进行认证');
      }

      // 启动 Google OAuth 流程，添加超时和重试机制
      try {
        console.log('正在初始化 Google OAuth 客户端...');
        
        // 设置超时时间
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OAuth 初始化超时')), 60000); // 60秒超时
        });
        
        const oauthPromise = getOauthClient();
        
        const oauthClient = await Promise.race([oauthPromise, timeoutPromise]) as any;
        console.log('Google OAuth 客户端初始化成功');
        
        // 即使获取 Google Account ID 失败，也不应该影响认证流程
        // 因为 OAuth 客户端已经成功初始化
        this.isAuthenticated = true;
        
        res.json({
          success: true,
          message: 'Google 登录成功',
          timestamp: new Date().toISOString()
        });
      } catch (oauthError) {
        console.error('Google OAuth 错误:', oauthError);
        
        // 检查是否是网络超时错误或其他可能导致缓存问题的错误
        const isNetworkError = oauthError instanceof Error && 
            (oauthError.message.includes('Connect Timeout') || 
             oauthError.message.includes('OAuth 初始化超时') ||
             oauthError.message.includes('fetch failed') ||
             oauthError.message.includes('network') ||
             oauthError.message.includes('timeout') ||
             oauthError.message.includes('invalid_grant') ||
             oauthError.message.includes('token_expired'));
        
        if (isNetworkError) {
          // 检查并清理可能过期的缓存凭据
          try {
            const wasCleaned = await this.checkAndCleanExpiredCredentials();
            if (wasCleaned) {
              console.log('检测到缓存问题，已清理OAuth缓存凭据');
            }
          } catch (cleanupError) {
            console.error('清理OAuth凭据时出错:', cleanupError);
          }
          
          res.status(500).json({ 
            success: false,
            message: '网络连接超时或缓存凭据过期，已自动清理缓存。请检查网络连接后重试。如果问题持续存在，请尝试使用 API Key 认证方式。',
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
      // 如果没有设置认证类型，优先尝试加载用户之前的选择
      if (this.currentAuthType === null) {
        console.log('检测到未设置认证类型，尝试加载用户之前的认证选择');
        
        // 1. 首先尝试加载用户之前的选择
        const userChoice = await this.loadUserAuthChoice();
        if (userChoice) {
          console.log('使用用户之前的认证选择:', userChoice);
          this.currentAuthType = userChoice;
          
          // 如果是Google OAuth，需要检查凭据是否有效
          if (userChoice === AuthType.LOGIN_WITH_GOOGLE) {
            try {
              // 尝试获取OAuth客户端来验证凭据
              await getOauthClient();
              this.isAuthenticated = true;
              console.log('Google OAuth凭据有效，已自动认证');
            } catch (error) {
              console.log('Google OAuth凭据无效，需要重新登录');
              this.isAuthenticated = false;
            }
          } else {
            // 对于API Key认证，需要从环境变量加载配置
            this.loadFromEnvironment();
          }
        } else {
          // 2. 如果没有用户选择，才从环境变量加载
          console.log('没有用户选择，尝试从环境变量加载认证配置');
          this.loadFromEnvironment();
        }
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

  private validateAuthMethod(authType: AuthType, apiKey?: string, googleCloudProject?: string, googleCloudLocation?: string): string | null {
    switch (authType) {
      case AuthType.LOGIN_WITH_GOOGLE:
        return null; // Google 登录不需要额外验证
        
      case AuthType.USE_GEMINI:
        if (!apiKey || apiKey.trim() === '') {
          return 'Gemini API Key 是必需的';
        }
        return null;
        
      case AuthType.USE_VERTEX_AI:
        if (!apiKey || apiKey.trim() === '') {
          return 'Google API Key 是必需的';
        }
        if (!googleCloudProject || googleCloudProject.trim() === '') {
          return 'Google Cloud Project ID 是必需的';
        }
        if (!googleCloudLocation || googleCloudLocation.trim() === '') {
          return 'Google Cloud Location 是必需的';
        }
        return null;
        
      default:
        return '不支持的认证类型';
    }
  }

  public async getContentGeneratorConfig() {
    if (!this.currentAuthType) {
      throw new Error('未设置认证类型');
    }

    return await createContentGeneratorConfig(
      'gemini-2.0-flash-exp',
      this.currentAuthType
    );
  }

  public isUserAuthenticated(): boolean {
    return this.isAuthenticated;
  }

  public getCurrentAuthType(): AuthType | null {
    return this.currentAuthType;
  }

  // 清除认证配置（登出）
  public async handleLogout(req: express.Request, res: express.Response) {
    try {
      console.log('用户登出，清除认证配置');
      
      // 清除所有认证信息
      this.currentAuthType = null;
      this.currentApiKey = null;
      this.currentGoogleCloudProject = null;
      this.currentGoogleCloudLocation = null;
      this.isAuthenticated = false;
      
      res.json(ResponseFactory.authConfig('登出成功，认证配置已清除'));
    } catch (error) {
      console.error('Error in handleLogout:', error);
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : '登出失败'));
    }
  }

  // 清除认证配置（切换认证方式）
  public async handleClearAuth(req: express.Request, res: express.Response) {
    try {
      console.log('清除认证配置，准备切换认证方式');
      
      // 清除所有认证信息
      this.currentAuthType = null;
      this.currentApiKey = null;
      this.currentGoogleCloudProject = null;
      this.currentGoogleCloudLocation = null;
      this.isAuthenticated = false;
      
      // 添加一个标记，防止立即重新加载环境变量
      console.log('认证配置已清除，等待客户端设置新的认证方式');
      
      res.json(ResponseFactory.authConfig('认证配置已清除，可以重新设置认证方式'));
    } catch (error) {
      console.error('Error in handleClearAuth:', error);
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : '清除认证配置失败'));
    }
  }


} 