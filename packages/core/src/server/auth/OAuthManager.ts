/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { getOauthClient, clearCachedCredentialFile } from '../../code_assist/oauth2.js';
import { AuthType } from '../../core/contentGenerator.js';
import { Config } from '../../config/config.js';

/**
 * OAuth管理器 - 负责OAuth凭据的验证和管理
 * 
 * 职责：
 * - OAuth凭据验证
 * - 过期凭据清理
 * - OAuth客户端管理
 */
export class OAuthManager {
  private readonly oauthCredsPath: string;
  private config: Config | null = null;

  constructor(config?: Config) {
    this.oauthCredsPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json');
    this.config = config || null;
  }

  /**
   * 设置配置对象
   */
  public setConfig(config: Config): void {
    this.config = config;
  }

  /**
   * 验证OAuth凭据是否有效
   * 
   * 让OAuth2Client自动处理令牌刷新，我们只需要检查基本的文件完整性
   */
  public async validateCredentials(): Promise<boolean> {
    try {
      console.log('开始验证OAuth凭据...');
      
      // 检查凭据文件是否存在
      try {
        await fs.access(this.oauthCredsPath);
        console.log('OAuth凭据文件存在');
      } catch {
        console.log('OAuth凭据文件不存在');
        return false;
      }

      // 检查凭据内容基本格式
      let creds;
      try {
        const credsData = await fs.readFile(this.oauthCredsPath, 'utf-8');
        creds = JSON.parse(credsData);
      } catch (error) {
        console.log('OAuth凭据文件格式无效:', error);
        return false;
      }
      
      // 基本格式检查
      if (!creds || typeof creds !== 'object') {
        console.log('OAuth凭据格式无效');
        return false;
      }

      // 检查必要字段 - 需要有access_token或refresh_token
      if (!creds.access_token && !creds.refresh_token) {
        console.log('OAuth凭据缺少必要的token');
        return false;
      }

      // 如果有过期时间，记录但不阻止验证
      if (creds.expiry_date) {
        const expiryDate = new Date(creds.expiry_date);
        const now = new Date();
        
        if (expiryDate <= now) {
          console.log('access_token已过期，将依赖OAuth2Client自动刷新:', expiryDate);
        } else {
          console.log('access_token有效期至:', expiryDate);
        }
      }

      // 尝试使用凭据获取OAuth客户端
      // OAuth2Client会自动处理令牌刷新逻辑
      try {
        console.log('尝试初始化OAuth客户端（会自动处理令牌刷新）...');
        if (!this.config) {
          throw new Error('Config 对象未设置，无法初始化 OAuth 客户端');
        }
        await getOauthClient(AuthType.LOGIN_WITH_GOOGLE, this.config);
        console.log('✅ OAuth凭据验证成功');
        return true;
      } catch (oauthError) {
        console.log('❌ OAuth客户端初始化失败:', oauthError);
        
        // 只有在明确的认证错误时才清理凭据
        if (this.isAuthenticationError(oauthError)) {
          console.log('检测到认证错误，清理无效凭据');
          await this.cleanExpiredCredentials();
        }
        return false;
      }
      
    } catch (error) {
      console.error('验证OAuth凭据时出错:', error);
      return false;
    }
  }

  /**
   * 初始化OAuth客户端（用于登录流程）
   */
  public async initializeOAuthClient(timeoutMs: number = 60000): Promise<void> {
    console.log('启动OAuth客户端初始化...');

    if (!this.config) {
      throw new Error('Config 对象未设置，无法初始化 OAuth 客户端');
    }

    // 设置超时时间
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('OAuth 初始化超时')), timeoutMs);
    });
    
    const oauthPromise = getOauthClient(AuthType.LOGIN_WITH_GOOGLE, this.config);
    
    await Promise.race([oauthPromise, timeoutPromise]);
    console.log('OAuth客户端初始化成功');
  }

  /**
   * 检查并清理过期的OAuth缓存凭据（仅用于登录流程）
   */
  private async checkAndCleanExpiredCredentials(): Promise<boolean> {
    try {
      // 检查凭据文件是否存在
      try {
        await fs.access(this.oauthCredsPath);
      } catch {
        // 文件不存在，无需清理
        return false;
      }

      // 读取凭据文件
      const credsData = await fs.readFile(this.oauthCredsPath, 'utf-8');
      const creds = JSON.parse(credsData);

      // 只有在明显损坏的情况下才清理
      if (this.isCredentialsCorrupted(creds)) {
        console.log('检测到损坏的OAuth凭据，正在清理...');
        await this.cleanExpiredCredentials();
        return true;
      }

      return false;
    } catch (error) {
      console.error('检查OAuth凭据时出错:', error);
      // 如果检查过程中出错，为了安全起见，清理缓存
      try {
        await this.cleanExpiredCredentials();
        return true;
      } catch (cleanupError) {
        console.error('清理OAuth凭据时出错:', cleanupError);
        return false;
      }
    }
  }

  /**
   * 判断凭据是否损坏（只检查基本格式）
   */
  private isCredentialsCorrupted(creds: any): boolean {
    // 检查凭据文件是否损坏
    if (typeof creds !== 'object' || creds === null) {
      return true;
    }

    // 必须有access_token或refresh_token中的一个
    if (!creds.access_token && !creds.refresh_token) {
      return true;
    }

    return false;
  }

  /**
   * 判断错误是否为认证错误（需要清理凭据）
   */
  private isAuthenticationError(error: any): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorMessage = error.message.toLowerCase();
    
    // 只有在明确的认证失败时才清理
    return errorMessage.includes('invalid_grant') ||
           errorMessage.includes('unauthorized') ||
           errorMessage.includes('invalid_token') ||
           errorMessage.includes('token has been expired or revoked') ||
           errorMessage.includes('authentication failed');
  }

  /**
   * 清理过期凭据
   */
  private async cleanExpiredCredentials(): Promise<void> {
    try {
      await clearCachedCredentialFile();
      console.log('已清理OAuth凭据缓存');
    } catch (error) {
      console.error('清理OAuth凭据时出错:', error);
    }
  }

  /**
   * 检查错误是否为网络相关错误
   */
  public isNetworkError(error: Error): boolean {
    return error.message.includes('Connect Timeout') || 
           error.message.includes('OAuth 初始化超时') ||
           error.message.includes('fetch failed') ||
           error.message.includes('network') ||
           error.message.includes('timeout') ||
           error.message.includes('ENOTFOUND') ||
           error.message.includes('ECONNREFUSED');
  }
} 