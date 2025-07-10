/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { AuthType } from '../../core/contentGenerator.js';

interface AuthConfig {
  authType: AuthType;
  apiKey?: string;
  googleCloudProject?: string;
  googleCloudLocation?: string;
  timestamp: string;
}

/**
 * 认证配置管理器 - 负责认证配置的持久化存储
 * 
 * 职责：
 * - 认证配置的保存和加载
 * - 文件系统操作
 * - 配置验证
 */
export class AuthConfigManager {
  private readonly configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), '.gemini', 'auth_config.json');
  }

  /**
   * 保存认证配置到本地文件
   */
  public async saveConfig(config: Omit<AuthConfig, 'timestamp'>): Promise<void> {
    try {
      // 确保目录存在
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      const fullConfig: AuthConfig = {
        ...config,
        timestamp: new Date().toISOString()
      };
      
      await fs.writeFile(this.configPath, JSON.stringify(fullConfig, null, 2));
      console.log('认证配置已保存:', config.authType);
    } catch (error) {
      console.error('保存认证配置失败:', error);
      throw new Error('保存认证配置失败');
    }
  }

  /**
   * 从本地文件加载认证配置
   */
  public async loadConfig(): Promise<AuthConfig | null> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      if (this.isValidConfig(config)) {
        console.log('成功加载认证配置:', config.authType);
        return config;
      } else {
        console.warn('认证配置格式无效');
        return null;
      }
    } catch (error) {
      // 文件不存在或格式错误
      console.log('没有找到有效的认证配置');
      return null;
    }
  }

  /**
   * 清除保存的认证配置
   */
  public async clearConfig(): Promise<void> {
    try {
      await fs.unlink(this.configPath);
      console.log('认证配置已清除');
    } catch (error) {
      // 文件可能不存在，忽略错误
      console.log('认证配置文件不存在或已清除');
    }
  }

  /**
   * 验证配置格式是否有效
   */
  private isValidConfig(config: any): config is AuthConfig {
    return config &&
           typeof config === 'object' &&
           config.authType &&
           Object.values(AuthType).includes(config.authType) &&
           typeof config.timestamp === 'string';
  }
} 