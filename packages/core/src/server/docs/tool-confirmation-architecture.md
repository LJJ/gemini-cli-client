# Gemini CLI 工具确认机制架构文档

## 概述

本文档详细描述了 gemini-cli 中工具确认机制的实现原理和架构设计，作为我们 server 开发的指导文档。

## 核心架构组件

### 1. CoreToolScheduler - 核心调度器

`CoreToolScheduler` 是工具调用的核心调度器，负责管理工具调用的整个生命周期。

#### 主要职责：
- 工具调用的状态管理
- 确认流程的处理
- 工具执行和结果处理
- 事件通知和回调管理

#### 关键方法：
```typescript
// 调度工具调用
async schedule(request: ToolCallRequestInfo | ToolCallRequestInfo[], signal: AbortSignal): Promise<void>

// 处理用户确认响应
async handleConfirmationResponse(
  callId: string,
  originalOnConfirm: (outcome: ToolConfirmationOutcome) => Promise<void>,
  outcome: ToolConfirmationOutcome,
  signal: AbortSignal
): Promise<void>

// 尝试执行已调度的工具调用
private attemptExecutionOfScheduledCalls(signal: AbortSignal): void
```

### 2. Turn - 对话轮次管理

`Turn` 类管理与 Gemini API 的对话轮次，处理流式响应和工具调用请求。

#### 主要职责：
- 与 Gemini API 的流式通信
- 解析响应中的工具调用请求
- 生成工具调用事件

#### 关键方法：
```typescript
// 运行对话轮次
async *run(req: PartListUnion, signal: AbortSignal): AsyncGenerator<ServerGeminiStreamEvent>

// 处理待处理的函数调用
private handlePendingFunctionCall(fnCall: FunctionCall): ServerGeminiStreamEvent | null
```

### 3. useReactToolScheduler - React Hook

React Hook 将核心调度器适配到 UI 层，管理工具调用的 UI 状态。

#### 主要职责：
- 将 CoreToolScheduler 的状态映射到 UI 状态
- 处理工具调用的 UI 更新
- 管理确认对话框的显示

## 工具调用状态流转

### 状态定义

```typescript
type ToolCallStatus = 
  | 'validating'      // 验证阶段
  | 'awaiting_approval' // 等待用户确认
  | 'scheduled'       // 已调度，等待执行
  | 'executing'       // 执行中
  | 'success'         // 执行成功
  | 'error'           // 执行错误
  | 'cancelled'       // 已取消
```

### 状态流转图

```
validating → awaiting_approval → scheduled → executing → success/error/cancelled
     ↓              ↓              ↓           ↓
  工具验证      用户确认      等待执行      执行工具
```

## 确认机制详解

### 1. 确认触发条件

工具可以通过实现 `shouldConfirmExecute` 方法来决定是否需要用户确认：

```typescript
async shouldConfirmExecute(
  params: Record<string, unknown>,
  abortSignal: AbortSignal
): Promise<ToolCallConfirmationDetails | false>
```

### 2. 确认类型

支持多种确认类型：

- **exec**: 执行命令确认
- **edit**: 文件编辑确认
- **info**: 信息获取确认
- **mcp**: MCP 工具确认

### 3. 确认结果

用户可以选择以下确认结果：

- **ProceedOnce**: 允许执行一次
- **ProceedAlways**: 总是允许执行
- **ProceedAlwaysServer**: 总是允许该服务器的工具
- **ProceedAlwaysTool**: 总是允许该工具
- **ModifyWithEditor**: 使用外部编辑器修改
- **Cancel**: 取消执行

## 事件驱动架构

### 1. 事件类型

```typescript
type ServerGeminiStreamEvent =
  | ServerGeminiContentEvent           // 文本内容
  | ServerGeminiToolCallRequestEvent   // 工具调用请求
  | ServerGeminiToolCallResponseEvent  // 工具调用响应
  | ServerGeminiToolCallConfirmationEvent // 工具确认事件
  | ServerGeminiUserCancelledEvent     // 用户取消
  | ServerGeminiErrorEvent             // 错误事件
  | ServerGeminiChatCompressedEvent    // 聊天压缩
  | ServerGeminiThoughtEvent           // 思考事件
```

### 2. 回调机制

CoreToolScheduler 使用多个回调函数来通知状态变化：

```typescript
interface CoreToolSchedulerOptions {
  onAllToolCallsComplete?: AllToolCallsCompleteHandler;  // 所有工具调用完成
  onToolCallsUpdate?: ToolCallsUpdateHandler;           // 工具调用状态更新
  outputUpdateHandler?: OutputUpdateHandler;            // 输出更新
}
```

## 实现原理

### 1. 工具调用请求处理

```typescript
// Turn 类中处理函数调用
private handlePendingFunctionCall(fnCall: FunctionCall): ServerGeminiStreamEvent | null {
  const toolCallRequest: ToolCallRequestInfo = {
    callId: fnCall.id ?? `${fnCall.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: fnCall.name || 'undefined_tool_name',
    args: (fnCall.args || {}) as Record<string, unknown>,
    isClientInitiated: false,
  };
  
  this.pendingToolCalls.push(toolCallRequest);
  return { type: GeminiEventType.ToolCallRequest, value: toolCallRequest };
}
```

### 2. 确认流程处理

```typescript
// CoreToolScheduler 中的确认处理
const confirmationDetails = await toolInstance.shouldConfirmExecute(reqInfo.args, signal);

if (confirmationDetails) {
  const originalOnConfirm = confirmationDetails.onConfirm;
  const wrappedConfirmationDetails: ToolCallConfirmationDetails = {
    ...confirmationDetails,
    onConfirm: (outcome: ToolConfirmationOutcome) =>
      this.handleConfirmationResponse(reqInfo.callId, originalOnConfirm, outcome, signal),
  };
  
  this.setStatusInternal(reqInfo.callId, 'awaiting_approval', wrappedConfirmationDetails);
} else {
  this.setStatusInternal(reqInfo.callId, 'scheduled');
}
```

### 3. 用户确认响应处理

```typescript
async handleConfirmationResponse(
  callId: string,
  originalOnConfirm: (outcome: ToolConfirmationOutcome) => Promise<void>,
  outcome: ToolConfirmationOutcome,
  signal: AbortSignal
): Promise<void> {
  // 调用原始的确认回调
  await originalOnConfirm(outcome);
  
  // 更新工具调用状态
  this.toolCalls = this.toolCalls.map((call) => {
    if (call.request.callId !== callId) return call;
    return { ...call, outcome };
  });
  
  // 根据确认结果决定下一步
  if (outcome === ToolConfirmationOutcome.Cancel || signal.aborted) {
    this.setStatusInternal(callId, 'cancelled', 'User did not allow tool call');
  } else if (outcome === ToolConfirmationOutcome.ModifyWithEditor) {
    // 处理编辑器修改
    // ...
  } else {
    this.setStatusInternal(callId, 'scheduled');
  }
  
  // 尝试执行已调度的工具调用
  this.attemptExecutionOfScheduledCalls(signal);
}
```

## 最佳实践

### 1. 状态管理

- 使用不可变的状态更新
- 确保状态转换的一致性
- 正确处理异步操作的状态

### 2. 错误处理

- 为每个状态转换提供错误处理
- 使用 AbortSignal 支持取消操作
- 提供有意义的错误信息

### 3. 事件通知

- 使用回调函数而不是直接状态访问
- 确保事件通知的及时性
- 避免事件循环和死锁

### 4. 工具实现

- 实现 `shouldConfirmExecute` 方法进行安全检查
- 提供清晰的确认信息
- 支持参数修改和验证

## 与我们的 Server 集成

### 1. 复用策略

我们应该完全复用 gemini-cli 的以下组件：
- `CoreToolScheduler` - 核心调度逻辑
- `Turn` - 对话管理
- 工具确认机制和状态管理

### 2. 适配要点

- 将 Web API 请求适配到 CoreToolScheduler 的接口
- 实现前端确认 UI 与后端状态同步
- 保持事件驱动的一致性

### 3. 扩展考虑

- 支持 Web 环境下的工具确认
- 实现跨会话的工具调用状态管理
- 添加 Web 特定的安全机制

## 总结

gemini-cli 的工具确认机制是一个设计完善的系统，具有以下特点：

1. **分层架构**: 核心逻辑与 UI 逻辑分离
2. **状态驱动**: 清晰的状态流转和事件通知
3. **类型安全**: 完整的 TypeScript 类型定义
4. **可扩展性**: 支持多种确认类型和结果
5. **错误处理**: 完善的错误处理和取消机制

我们应该充分利用这个成熟的架构，确保我们的 server 实现具有相同的可靠性和功能完整性。 