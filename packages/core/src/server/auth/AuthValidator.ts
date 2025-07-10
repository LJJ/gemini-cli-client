/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '../../core/contentGenerator.js';

/**
 * 认证验证器 - 负责认证方法和参数的验证
 * 
 * 职责：
 * - 认证类型验证
 * - 认证参数验证
 * - 环境变量验证
 */
export class AuthValidator {

  /**
   * 验证认证方法和参数
   */
  public validateAuthMethod(
    authType: AuthType, 
    apiKey?: string, 
    googleCloudProject?: string, 
    googleCloudLocation?: string
  ): string | null {
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

  /**
   * 从环境变量加载认证配置
   */
  public loadFromEnvironment(): {
    authType: AuthType | null;
    apiKey: string | null;
    googleCloudProject: string | null;
    googleCloudLocation: string | null;
  } {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
    const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION;

    if (geminiApiKey) {
      console.log('从环境变量加载 Gemini API Key 认证');
      return {
        authType: AuthType.USE_GEMINI,
        apiKey: geminiApiKey,
        googleCloudProject: null,
        googleCloudLocation: null,
      };
    } else if (googleApiKey && googleCloudProject && googleCloudLocation) {
      console.log('从环境变量加载 Google Cloud 认证');
      return {
        authType: AuthType.USE_VERTEX_AI,
        apiKey: googleApiKey,
        googleCloudProject,
        googleCloudLocation,
      };
    }

    return {
      authType: null,
      apiKey: null,
      googleCloudProject: null,
      googleCloudLocation: null,
    };
  }
} 