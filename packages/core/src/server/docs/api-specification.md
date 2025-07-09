# Gemini CLI API 规范文档

## 概述

本文档定义了 Gemini CLI API 服务器的所有端点、请求格式和响应格式。所有 API 都遵循统一的响应结构，确保客户端能够一致地处理响应。

## 基础响应格式

所有 API 响应都包含以下基础字段：

```typescript
interface BaseResponse {
  success: boolean;           // 操作是否成功
  message?: string;          // 响应消息
  timestamp: string;         // ISO 8601 时间戳
  error?: string;           // 错误信息（仅在失败时）
}
```

## 1. 健康检查

### GET /status

**描述**: 检查服务器健康状态

**请求**: 无参数

**响应**:
```typescript
interface StatusResponse extends BaseResponse {
  status: 'ok';
  version: string;
}
```

**示例**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "version": "0.1.9"
}
```

## 2. 认证相关 API

### POST /auth/config

**描述**: 设置认证配置

**请求**:
```typescript
interface AuthConfigRequest {
  authType: 'gemini-api-key' | 'oauth-personal' | 'vertex-ai';
  apiKey?: string;                    // API Key 认证时必需
  googleCloudProject?: string;        // Google OAuth 时必需
  googleCloudLocation?: string;       // Google OAuth 时必需
}
```

**响应**:
```typescript
interface AuthConfigResponse extends BaseResponse {
  success: boolean;
  message: string;
}
```

**示例**:
```json
{
  "success": true,
  "message": "认证配置已设置",
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

### POST /auth/google-login

**描述**: 处理 Google OAuth 登录

**请求**:
```typescript
interface GoogleLoginRequest {
  code: string;              // OAuth 授权码
  state?: string;           // OAuth state 参数
}
```

**响应**:
```typescript
interface GoogleLoginResponse extends BaseResponse {
  success: boolean;
  message: string;
}
```

### GET /auth/status

**描述**: 查询当前认证状态

**请求**: 无参数

**响应**:
```typescript
interface AuthStatusResponse extends BaseResponse {
  data: {
    isAuthenticated: boolean;
    authType: 'gemini-api-key' | 'oauth-personal' | 'vertex-ai' | null;
    hasApiKey: boolean;
    hasGoogleCloudConfig: boolean;
  };
}
```

**示例**:
```json
{
  "success": true,
  "message": "认证状态查询成功",
  "data": {
    "isAuthenticated": true,
    "authType": "gemini-api-key",
    "hasApiKey": true,
    "hasGoogleCloudConfig": false
  },
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

### POST /auth/logout

**描述**: 用户登出

**请求**: 无参数

**响应**:
```typescript
interface LogoutResponse extends BaseResponse {
  success: boolean;
  message: string;
}
```

### POST /auth/clear

**描述**: 清除认证配置

**请求**: 无参数

**响应**:
```typescript
interface ClearAuthResponse extends BaseResponse {
  success: boolean;
  message: string;
}
```

## 3. 聊天功能

### POST /chat

**描述**: 发送消息到 Gemini 并获取响应

**请求**:
```typescript
interface ChatRequest {
  message: string;           // 用户消息
  stream?: boolean;         // 是否使用流式响应（默认 false）
  filePaths?: string[];     // 要分析的文件路径列表（可选）
  workspacePath?: string;   // 工作目录路径（可选）
}
```

**非流式响应**:
```typescript
interface ChatResponse extends BaseResponse {
  response: string;         // Gemini 的文本响应
  hasToolCalls?: boolean;   // 是否包含工具调用
  toolCalls?: ToolCall[];   // 工具调用列表
}
```

**流式响应**:
使用 Server-Sent Events 格式，每个事件都是一个 JSON 对象：

```typescript
interface StreamingEvent {
  type: 'content' | 'thought' | 'tool_call' | 'tool_execution' | 'tool_result' | 'tool_confirmation' | 'complete' | 'error';
  data: any;
  timestamp: string;
}
```

**事件类型详细定义**:

1. **content** - 文本内容片段
```typescript
{
  "type": "content",
  "data": {
    "text": "Hello! How can I help you today?",
    "isPartial": true
  },
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

2. **thought** - AI 思考过程
```typescript
{
  "type": "thought",
  "data": {
    "subject": "Considering a Response",
    "description": "I'm thinking about how to best answer this question..."
  },
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

3. **tool_call** - 工具调用请求
```typescript
{
  "type": "tool_call",
  "data": {
    "callId": "read-123",
    "name": "read_file",
    "displayName": "Read File",
    "description": "读取指定文件的内容",
    "args": {
      "path": "/path/to/file.txt"
    },
    "requiresConfirmation": true
  },
  "timestamp": "2025-01-20T10:30:01.000Z"
}
```

4. **tool_execution** - 工具执行状态
```typescript
{
  "type": "tool_execution",
  "data": {
    "callId": "read-123",
    "status": "executing", // "pending", "executing", "completed", "failed"
    "message": "正在执行 read_file..."
  },
  "timestamp": "2025-01-20T10:30:01.000Z"
}
```

5. **tool_result** - 工具执行结果
```typescript
{
  "type": "tool_result",
  "data": {
    "callId": "read-123",
    "name": "read_file",
    "result": "文件的实际内容",
    "displayResult": "📄 文件内容已读取",
    "success": true,
    "error": null
  },
  "timestamp": "2025-01-20T10:30:02.000Z"
}
```

6. **tool_confirmation** - 工具确认请求
```typescript
{
  "type": "tool_confirmation",
  "data": {
    "callId": "read-123",
    "name": "read_file",
    "displayName": "Read File",
    "description": "需要确认工具调用: read_file",
    "prompt": "是否执行工具调用: read_file",
    "command": "read_file /path/to/file.txt"
  },
  "timestamp": "2025-01-20T10:30:01.000Z"
}
```

7. **complete** - 对话完成
```typescript
{
  "type": "complete",
  "data": {
    "success": true,
    "message": "对话完成"
  },
  "timestamp": "2025-01-20T10:30:03.000Z"
}
```

8. **error** - 错误信息
```typescript
{
  "type": "error",
  "data": {
    "message": "发生错误",
    "code": "ERROR_CODE",
    "details": "详细错误信息"
  },
  "timestamp": "2025-01-20T10:30:03.000Z"
}
```

**完整流式响应示例**:
```json
{"type":"content","data":{"text":"正在处理您的请求...","isPartial":true},"timestamp":"2025-01-20T10:30:00.000Z"}
{"type":"thought","data":{"subject":"Considering a Response","description":"I'm analyzing the user's request..."},"timestamp":"2025-01-20T10:30:01.000Z"}
{"type":"tool_call","data":{"callId":"read-123","name":"read_file","displayName":"Read File","description":"读取文件内容","args":{"path":"/path/to/file.txt"},"requiresConfirmation":true},"timestamp":"2025-01-20T10:30:02.000Z"}
{"type":"tool_confirmation","data":{"callId":"read-123","name":"read_file","displayName":"Read File","description":"需要确认工具调用: read_file","prompt":"是否执行工具调用: read_file","command":"read_file /path/to/file.txt"},"timestamp":"2025-01-20T10:30:02.000Z"}
{"type":"tool_execution","data":{"callId":"read-123","status":"executing","message":"正在执行 read_file..."},"timestamp":"2025-01-20T10:30:03.000Z"}
{"type":"tool_result","data":{"callId":"read-123","name":"read_file","result":"文件内容","displayResult":"📄 文件内容已读取","success":true,"error":null},"timestamp":"2025-01-20T10:30:04.000Z"}
{"type":"content","data":{"text":"根据文件内容，我的回答是...","isPartial":false},"timestamp":"2025-01-20T10:30:05.000Z"}
{"type":"complete","data":{"success":true,"message":"对话完成"},"timestamp":"2025-01-20T10:30:06.000Z"}
```

### POST /tool-confirmation

**描述**: 确认或拒绝工具调用

**请求**:
```typescript
interface ToolConfirmationRequest {
  callId: string;           // 工具调用 ID
  outcome: 'proceed_once' | 'proceed_always' | 'proceed_always_server' | 'proceed_always_tool' | 'modify_with_editor' | 'cancel';  // 确认结果
}
```

**响应**:
```typescript
interface ToolConfirmationResponse extends BaseResponse {
  success: boolean;
  message: string;
}
```

## 4. 文件操作

### GET /list-directory

**描述**: 列出目录内容

**请求参数**:
```typescript
interface ListDirectoryQuery {
  path?: string;            // 目录路径（默认为当前目录）
}
```

**响应**:
```typescript
interface ListDirectoryResponse extends BaseResponse {
  path: string;             // 完整路径
  items: DirectoryItem[];   // 目录项列表
}

interface DirectoryItem {
  name: string;             // 文件/目录名
  type: 'file' | 'directory'; // 类型
  path: string;             // 完整路径
}
```

**示例**:
```json
{
  "path": "/Users/username/project",
  "items": [
    {
      "name": "src",
      "type": "directory",
      "path": "/Users/username/project/src"
    },
    {
      "name": "package.json",
      "type": "file",
      "path": "/Users/username/project/package.json"
    }
  ],
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

### POST /read-file

**描述**: 读取文件内容

**请求**:
```typescript
interface ReadFileRequest {
  path: string;             // 文件路径
}
```

**响应**:
```typescript
interface ReadFileResponse extends BaseResponse {
  path: string;             // 文件路径
  content: string | null;   // 文件内容
  success: boolean;         // 是否成功读取
  message?: string;         // 错误消息（失败时）
}
```

**示例**:
```json
{
  "path": "/Users/username/project/package.json",
  "content": "{\n  \"name\": \"my-project\",\n  \"version\": \"1.0.0\"\n}",
  "success": true,
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

### POST /write-file

**描述**: 写入文件内容

**请求**:
```typescript
interface WriteFileRequest {
  path: string;             // 文件路径
  content: string;          // 文件内容
}
```

**响应**:
```typescript
interface WriteFileResponse extends BaseResponse {
  path: string;             // 文件路径
  content: string;          // 写入的内容
  success: boolean;         // 是否成功写入
  message?: string;         // 错误消息（失败时）
}
```

## 5. 命令执行

### POST /execute-command

**描述**: 执行系统命令

**请求**:
```typescript
interface ExecuteCommandRequest {
  command: string;          // 要执行的命令
  cwd?: string;            // 工作目录（可选）
}
```

**响应**:
```typescript
interface ExecuteCommandResponse extends BaseResponse {
  command: string;          // 执行的命令
  output: string;          // 标准输出
  stderr: string | null;   // 标准错误
  exitCode: number;        // 退出码
}
```

**示例**:
```json
{
  "command": "ls -la",
  "output": "total 8\ndrwxr-xr-x  5 user  staff  160 Jan 20 10:30 .\ndrwxr-xr-x  3 user  staff   96 Jan 20 10:29 ..",
  "stderr": null,
  "exitCode": 0,
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

## 错误处理

所有 API 在发生错误时都返回统一的错误格式：

```typescript
interface ErrorResponse extends BaseResponse {
  success: false;
  error: string;           // 错误类型
  message: string;         // 详细错误信息
  timestamp: string;
}
```

**HTTP 状态码**:
- `200`: 成功
- `400`: 请求参数错误
- `401`: 认证失败
- `404`: 资源不存在
- `500`: 服务器内部错误

**示例错误响应**:
```json
{
  "success": false,
  "error": "File not found",
  "message": "The specified file does not exist",
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

## 注意事项

1. **时间戳格式**: 所有时间戳都使用 ISO 8601 格式
2. **字符编码**: 所有文本内容都使用 UTF-8 编码
3. **跨域支持**: API 支持 CORS，允许跨域请求
4. **流式响应**: 聊天 API 支持流式响应，使用 Server-Sent Events 格式
5. **工具调用**: 聊天 API 支持工具调用，包括文件操作和命令执行
6. **认证持久化**: 认证配置会在服务器重启后保持 