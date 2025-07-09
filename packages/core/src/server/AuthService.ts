/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { AuthType, createContentGeneratorConfig } from '../core/contentGenerator.js';
import { getOauthClient } from '../code_assist/oauth2.js';

export class AuthService {
  private currentAuthType: AuthType | null = null;
  private currentApiKey: string | null = null;
  private currentGoogleCloudProject: string | null = null;
  private currentGoogleCloudLocation: string | null = null;
  private isAuthenticated = false;

  constructor() {
    // 初始化时尝试从环境变量加载认证配置
    this.loadFromEnvironment();
  }

  private loadFromEnvironment() {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
    const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION;

    if (geminiApiKey) {
      this.currentAuthType = AuthType.USE_GEMINI;
      this.currentApiKey = geminiApiKey;
      this.isAuthenticated = true;
    } else if (googleApiKey && googleCloudProject && googleCloudLocation) {
      this.currentAuthType = AuthType.USE_VERTEX_AI;
      this.currentApiKey = googleApiKey;
      this.currentGoogleCloudProject = googleCloudProject;
      this.currentGoogleCloudLocation = googleCloudLocation;
      this.isAuthenticated = true;
    }
  }

  public async handleAuthConfig(req: express.Request, res: express.Response) {
    try {
      const { authType, apiKey, googleCloudProject, googleCloudLocation } = req.body;

      if (!authType) {
        return res.status(400).json({ 
          success: false, 
          message: '认证类型是必需的' 
        });
      }

      console.log('设置认证配置:', { authType, hasApiKey: !!apiKey, googleCloudProject, googleCloudLocation });

      // 验证认证方法
      const validationError = this.validateAuthMethod(authType, apiKey, googleCloudProject, googleCloudLocation);
      if (validationError) {
        return res.status(400).json({ 
          success: false, 
          message: validationError 
        });
      }

      // 保存认证配置
      this.currentAuthType = authType;
      this.currentApiKey = apiKey || null;
      this.currentGoogleCloudProject = googleCloudProject || null;
      this.currentGoogleCloudLocation = googleCloudLocation || null;

      // 根据认证类型处理
      if (authType === AuthType.LOGIN_WITH_GOOGLE) {
        // Google 登录需要特殊处理
        this.isAuthenticated = false; // 需要完成登录流程
      } else {
        // API Key 认证直接完成
        this.isAuthenticated = true;
      }

      res.json({
        success: true,
        message: '认证配置已设置',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error in handleAuthConfig:', error);
      res.status(500).json({ 
        success: false,
        message: '设置认证配置失败',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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

      // 启动 Google OAuth 流程，添加超时和重试机制
      try {
        console.log('正在初始化 Google OAuth 客户端...');
        
        // 设置超时时间
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OAuth 初始化超时')), 30000); // 30秒超时
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
        
        // 检查是否是网络超时错误
        if (oauthError instanceof Error && 
            (oauthError.message.includes('Connect Timeout') || 
             oauthError.message.includes('OAuth 初始化超时') ||
             oauthError.message.includes('fetch failed'))) {
          res.status(500).json({ 
            success: false,
            message: '网络连接超时，请检查网络连接后重试。如果问题持续存在，请尝试使用 API Key 认证方式。',
            error: '网络连接超时'
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
      res.json({
        success: true,
        message: '认证状态查询成功',
        data: {
          isAuthenticated: this.isAuthenticated,
          authType: this.currentAuthType,
          hasApiKey: !!this.currentApiKey,
          hasGoogleCloudConfig: !!(this.currentGoogleCloudProject && this.currentGoogleCloudLocation)
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error in handleAuthStatus:', error);
      res.status(500).json({ 
        success: false,
        message: '查询认证状态失败',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
} 