/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseResponse, ErrorResponse } from '../types/api-types.js';

/**
 * 响应工厂类 - 确保所有API响应都遵循标准格式
 */
export class ResponseFactory {
  /**
   * 创建成功响应
   */
  static success<T extends Record<string, any>>(data: T): BaseResponse & T {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      ...data
    };
  }

  /**
   * 创建错误响应
   */
  static error(error: string, message: string, statusCode: number = 500): ErrorResponse {
    return {
      success: false,
      error,
      message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建认证配置响应
   */
  static authConfig(message: string) {
    return this.success({ message });
  }

  /**
   * 创建认证状态响应
   */
  static authStatus(data: {
    isAuthenticated: boolean;
    authType: string | null;
    hasApiKey: boolean;
    hasGoogleCloudConfig: boolean;
  }) {
    return this.success({
      message: '认证状态查询成功',
      data
    });
  }

  /**
   * 创建聊天响应
   */
  static chat(response: string, hasToolCalls: boolean = false, toolCalls?: any[]) {
    return this.success({
      response,
      hasToolCalls,
      ...(toolCalls && { toolCalls })
    });
  }

  /**
   * 创建工具确认响应
   */
  static toolConfirmation(message: string) {
    return this.success({ message });
  }

  /**
   * 创建目录列表响应
   */
  static listDirectory(path: string, items: any[]) {
    return this.success({ path, items });
  }

  /**
   * 创建文件读取响应
   */
  static readFile(path: string, content: string | null, success: boolean, message?: string) {
    return this.success({ path, content, success, ...(message && { message }) });
  }

  /**
   * 创建文件写入响应
   */
  static writeFile(path: string, content: string, success: boolean, message?: string) {
    return this.success({ path, content, success, ...(message && { message }) });
  }

  /**
   * 创建命令执行响应
   */
  static executeCommand(command: string, output: string, stderr: string | null, exitCode: number) {
    return this.success({ command, output, stderr, exitCode });
  }

  /**
   * 创建健康检查响应
   */
  static status(version: string) {
    return this.success({
      status: 'ok' as const,
      version
    });
  }

  /**
   * 创建模型状态响应
   */
  static modelStatus(data: {
    currentModel: string;
    supportedModels: string[];
    modelStatuses: Array<{
      name: string;
      available: boolean;
      status: 'available' | 'unavailable' | 'unknown';
      message: string;
    }>;
  }) {
    return this.success({
      message: '模型状态查询成功',
      ...data
    });
  }

  /**
   * 创建模型切换响应
   */
  static modelSwitch(model: {
    name: string;
    previousModel: string;
    switched: boolean;
    available?: boolean;
    status?: 'available' | 'unavailable' | 'unknown';
    availabilityMessage?: string;
  }, message: string) {
    return this.success({
      message,
      model
    });
  }

  /**
   * 创建参数验证错误响应
   */
  static validationError(field: string, message: string) {
    return this.error('Validation Error', `${field}: ${message}`, 400);
  }

  /**
   * 创建认证错误响应
   */
  static authError(message: string) {
    return this.error('Authentication Error', message, 401);
  }

  /**
   * 创建资源未找到错误响应
   */
  static notFoundError(resource: string) {
    return this.error('Not Found', `${resource} not found`, 404);
  }

  /**
   * 创建服务器内部错误响应
   */
  static internalError(message: string) {
    return this.error('Internal Server Error', message, 500);
  }
}

/**
 * 响应验证器 - 验证响应是否符合标准格式
 */
export class ResponseValidator {
  /**
   * 验证响应是否包含必需的基础字段
   */
  static validateBaseResponse(response: any): response is BaseResponse {
    return (
      typeof response === 'object' &&
      response !== null &&
      typeof response.success === 'boolean' &&
      typeof response.timestamp === 'string'
    );
  }

  /**
   * 验证错误响应格式
   */
  static validateErrorResponse(response: any): response is ErrorResponse {
    return (
      this.validateBaseResponse(response) &&
      response.success === false &&
      typeof response.error === 'string' &&
      typeof response.message === 'string'
    );
  }

  /**
   * 验证成功响应格式
   */
  static validateSuccessResponse(response: any): response is BaseResponse {
    return (
      this.validateBaseResponse(response) &&
      response.success === true
    );
  }

  /**
   * 强制标准化响应格式
   */
  static normalizeResponse(response: any): BaseResponse {
    if (this.validateBaseResponse(response)) {
      return response;
    }

    // 如果不是标准格式，尝试转换
    if (typeof response === 'string') {
      return ResponseFactory.success({ response });
    }

    if (typeof response === 'object' && response !== null) {
      // 尝试从现有对象中提取有用信息
      const { message, error, ...rest } = response;
      return ResponseFactory.success({
        ...rest,
        ...(message && { message }),
        ...(error && { error })
      });
    }

    // 最后的兜底方案
    return ResponseFactory.internalError('Invalid response format');
  }
}

/**
 * 中间件 - 自动标准化所有响应
 */
export function responseStandardizationMiddleware(req: any, res: any, next: any) {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // 自动标准化响应格式
    const normalizedData = ResponseValidator.normalizeResponse(data);
    return originalJson.call(this, normalizedData);
  };
  
  next();
}

/**
 * 装饰器 - 用于类方法自动标准化响应
 */
export function standardizeResponse(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = async function(...args: any[]) {
    try {
      const result = await method.apply(this, args);
      
      // 如果方法返回了响应对象，自动标准化
      if (result && typeof result === 'object' && 'success' in result) {
        return ResponseValidator.normalizeResponse(result);
      }
      
      return result;
    } catch (error) {
      // 自动处理错误并返回标准错误响应
      return ResponseFactory.internalError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };
  
  return descriptor;
} 