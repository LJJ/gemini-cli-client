/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 错误代码枚举 - 基于当前实际使用的错误场景
 */
export enum ErrorCode {
  // 验证错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  
  // 认证相关错误
  AUTH_NOT_SET = 'AUTH_NOT_SET',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_CONFIG_FAILED = 'AUTH_CONFIG_FAILED',
  OAUTH_INIT_FAILED = 'OAUTH_INIT_FAILED',
  
  // 客户端初始化错误
  CLIENT_NOT_INITIALIZED = 'CLIENT_NOT_INITIALIZED',
  CLIENT_INIT_FAILED = 'CLIENT_INIT_FAILED',
  
  // 流式处理错误
  STREAM_ERROR = 'STREAM_ERROR',
  TURN_NOT_INITIALIZED = 'TURN_NOT_INITIALIZED',
  ABORT_CONTROLLER_NOT_INITIALIZED = 'ABORT_CONTROLLER_NOT_INITIALIZED',
  
  // Gemini API 错误
  GEMINI_ERROR = 'GEMINI_ERROR',
  
  // 工具相关错误
  TOOL_SCHEDULER_NOT_INITIALIZED = 'TOOL_SCHEDULER_NOT_INITIALIZED',
  TOOL_CALL_NOT_FOUND = 'TOOL_CALL_NOT_FOUND',
  TOOL_INVALID_OUTCOME = 'TOOL_INVALID_OUTCOME',
  
  // 通用错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 错误代码描述映射
 */
export const ERROR_DESCRIPTIONS: Record<ErrorCode, string> = {
  [ErrorCode.VALIDATION_ERROR]: '请求参数验证失败',
  [ErrorCode.AUTH_NOT_SET]: '未设置认证类型',
  [ErrorCode.AUTH_REQUIRED]: '用户未认证，请先完成认证设置',
  [ErrorCode.AUTH_CONFIG_FAILED]: '认证配置失败',
  [ErrorCode.OAUTH_INIT_FAILED]: 'OAuth 客户端初始化失败',
  [ErrorCode.CLIENT_NOT_INITIALIZED]: 'Gemini 客户端未初始化',
  [ErrorCode.CLIENT_INIT_FAILED]: 'Gemini 客户端初始化失败',
  [ErrorCode.STREAM_ERROR]: '流式处理错误',
  [ErrorCode.TURN_NOT_INITIALIZED]: 'Turn 或 AbortController 未初始化',
  [ErrorCode.ABORT_CONTROLLER_NOT_INITIALIZED]: 'AbortController 未初始化',
  [ErrorCode.GEMINI_ERROR]: 'Gemini API 错误',
  [ErrorCode.TOOL_SCHEDULER_NOT_INITIALIZED]: '工具调度器未初始化',
  [ErrorCode.TOOL_CALL_NOT_FOUND]: '工具调用未找到或不在等待确认状态',
  [ErrorCode.TOOL_INVALID_OUTCOME]: '无效的工具调用结果',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.NETWORK_ERROR]: '网络连接错误',
  [ErrorCode.UNKNOWN_ERROR]: '未知错误'
};

/**
 * 创建带错误代码的错误对象
 */
export function createError(code: ErrorCode, customMessage?: string): Error {
  const error = new Error(customMessage || ERROR_DESCRIPTIONS[code]);
  (error as any).code = code;
  return error;
} 