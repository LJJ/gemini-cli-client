/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// 基础响应格式
export interface BaseResponse {
  success: boolean;
  message?: string;
  timestamp: string;
  error?: string;
}

// 错误响应格式
export interface ErrorResponse extends BaseResponse {
  success: false;
  error: string;
  message: string;
}

// 1. 健康检查
export interface StatusResponse extends BaseResponse {
  status: 'ok';
  version: string;
}

// 2. 认证相关
export type AuthType = 'gemini-api-key' | 'oauth-personal' | 'vertex-ai';

export interface AuthConfigRequest {
  authType: AuthType;
  apiKey?: string;
  googleCloudProject?: string;
  googleCloudLocation?: string;
}

export interface AuthConfigResponse extends BaseResponse {
  success: boolean;
  message: string;
}

export interface GoogleLoginRequest {
  code: string;
  state?: string;
}

export interface GoogleLoginResponse extends BaseResponse {
  success: boolean;
  message: string;
}

export interface AuthStatusResponse extends BaseResponse {
  data: {
    isAuthenticated: boolean;
    authType: AuthType | null;
    hasApiKey: boolean;
    hasGoogleCloudConfig: boolean;
  };
}

export interface LogoutResponse extends BaseResponse {
  success: boolean;
  message: string;
}

export interface ClearAuthResponse extends BaseResponse {
  success: boolean;
  message: string;
}

// 3. 聊天功能
export interface ChatRequest {
  message: string;
  stream?: boolean;
}

export interface ChatResponse extends BaseResponse {
  response: string;
  hasToolCalls?: boolean;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// 流式响应事件
export type StreamingEventType = 'content' | 'tool_execution' | 'tool_result' | 'complete' | 'error';

export interface StreamingEvent {
  type: StreamingEventType;
  data: any;
  timestamp: string;
}

export interface ContentEventData {
  text: string;
  isPartial?: boolean;
}

export interface ToolExecutionEventData {
  callId: string;
  status: 'executing' | 'completed' | 'failed';
  message: string;
}

export interface ToolResultEventData {
  callId: string;
  name: string;
  result: string;
  displayResult: string;
  success: boolean;
  error: string | null;
}

export interface CompleteEventData {
  success: boolean;
  message: string;
}

export interface ErrorEventData {
  message: string;
  code?: string;
  details?: string;
}

// 工具确认
export interface ToolConfirmationRequest {
  callId: string;
  outcome: 'proceed_once' | 'proceed_always' | 'proceed_always_server' | 'proceed_always_tool' | 'modify_with_editor' | 'cancel';
}

export interface ToolConfirmationResponse extends BaseResponse {
  success: boolean;
  message: string;
}

// 4. 文件操作
export interface ListDirectoryQuery {
  path?: string;
}

export interface DirectoryItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
}

export interface ListDirectoryResponse extends BaseResponse {
  path: string;
  items: DirectoryItem[];
}

export interface ReadFileRequest {
  path: string;
}

export interface ReadFileResponse extends BaseResponse {
  path: string;
  content: string | null;
  success: boolean;
  message?: string;
}

export interface WriteFileRequest {
  path: string;
  content: string;
}

export interface WriteFileResponse extends BaseResponse {
  path: string;
  content: string;
  success: boolean;
  message?: string;
}

// 5. 命令执行
export interface ExecuteCommandRequest {
  command: string;
  cwd?: string;
}

export interface ExecuteCommandResponse extends BaseResponse {
  command: string;
  output: string;
  stderr: string | null;  // 重命名为 stderr 避免与 BaseResponse.error 冲突
  exitCode: number;
}

// 工具调用相关类型
export interface ToolCallRequestInfo {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  isClientInitiated: boolean;
}

export interface ToolCallResponseInfo {
  callId: string;
  response: any;
  error?: string;
}

// 工具执行结果
export interface ToolExecutionResult {
  callId: string;
  name: string;
  result: any;
  success: boolean;
  error?: string;
}

// 工具确认详情
export interface ToolConfirmationDetails {
  callId: string;
  name: string;
  displayName: string;
  description: string;
  prompt: string;
  command?: string | null;
  requiresConfirmation: boolean;
}

// 工具调用状态
export type ToolCallStatus = 'pending' | 'executing' | 'awaiting_approval' | 'success' | 'error' | 'cancelled';

export interface ToolCallState {
  request: ToolCallRequestInfo;
  status: ToolCallStatus;
  response?: any;
  error?: string;
  confirmationDetails?: ToolConfirmationDetails;
}

// 工具注册表
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolRegistry {
  getFunctionDeclarations(): FunctionDeclaration[];
  getTool(name: string): Tool | null;
}

export interface Tool {
  name: string;
  description: string;
  execute(args: Record<string, unknown>, signal: AbortSignal): Promise<any>;
}

// 配置相关
export interface ServerConfig {
  port: number;
  cors: boolean;
  auth: {
    type: AuthType;
    apiKey?: string;
    googleCloudProject?: string;
    googleCloudLocation?: string;
  };
  tools: {
    enabled: string[];
    approvalMode: 'default' | 'automatic' | 'manual';
  };
}

// 客户端配置
export interface ClientConfig {
  serverUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// 会话相关
export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolExecutionResult[];
}

// 统计信息
export interface ChatStats {
  totalMessages: number;
  totalTokens: number;
  averageResponseTime: number;
  toolCallCount: number;
  sessionDuration: number;
}

// 模型信息
export interface ModelInfo {
  name: string;
  version: string;
  capabilities: string[];
  maxTokens: number;
  supportsTools: boolean;
}

// 系统状态
export interface SystemStatus {
  server: {
    status: 'running' | 'stopped' | 'error';
    uptime: number;
    version: string;
  };
  auth: {
    isAuthenticated: boolean;
    authType: AuthType | null;
  };
  tools: {
    available: string[];
    enabled: string[];
  };
  model: {
    name: string;
    status: 'available' | 'unavailable' | 'error';
  };
} 