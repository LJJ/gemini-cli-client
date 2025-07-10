# Server 工具确认机制实现指南

## 概述

本文档提供了将 gemini-cli 工具确认机制集成到我们 server 的具体实现指南。

## 目录结构说明

我们的 server 实现采用职责分离的模块化结构，每个模块都有明确的单一职责：

```
server/
├── auth/           # 认证相关服务
├── chat/           # 聊天与流式事件服务  
├── tools/          # 工具与命令服务
├── files/          # 文件操作服务
├── core/           # 核心服务
├── types/          # 类型定义
├── utils/          # 工具类
└── docs/           # 文档
```

这种结构遵循 SOLID 设计原则，确保每个模块职责明确，便于维护和扩展。

## 当前实现分析

### 现有架构

我们当前的 server 实现采用职责分离结构，包括：

#### 认证模块 (auth/)
- **AuthService** - 认证流程协调，HTTP请求处理，认证状态管理
- **AuthConfigManager** - 认证配置的持久化和加载
- **OAuthManager** - OAuth流程的具体实现
- **AuthValidator** - 认证参数的验证

#### 聊天模块 (chat/)
- **ChatHandler** - 聊天消息处理，流式响应管理，事件分发
- **StreamingEventService** - 结构化事件创建和发送

#### 工具模块 (tools/)
- **ToolOrchestrator** - 工具调用的调度和状态管理
- **CommandService** - 命令执行服务

#### 文件模块 (files/)
- **FileService** - 文件读写、目录列表等文件操作

#### 核心模块 (core/)
- **GeminiService** - 服务组合和协调，HTTP请求处理
- **ClientManager** - Gemini客户端初始化和管理
- **ServerConfig** - 服务器配置管理

### 需要改进的地方

1. **工具确认处理不够完善**
   - 当前使用简单的 `pendingToolCalls` Map 管理
   - 缺少完整的状态流转机制
   - 没有复用 `CoreToolScheduler` 的成熟逻辑

2. **事件处理机制简单**
   - 缺少完整的事件驱动架构
   - 状态更新不够及时和一致

## 改进方案

### 1. 重构 GeminiService

#### 当前实现问题
```typescript
// 当前简单实现
private pendingToolCalls = new Map<string, {
  request: ToolCallRequestInfo;
  status: 'waiting_confirmation' | 'confirmed' | 'cancelled';
}>();

private async waitForToolConfirmation(callId: string): Promise<void> {
  // 简单的轮询等待
}
```

#### 改进后的实现
```typescript
export class GeminiService {
  private toolScheduler: CoreToolScheduler;
  private turn: Turn;
  
  constructor(config: ServerConfig) {
    this.toolScheduler = new CoreToolScheduler({
      toolRegistry: config.getToolRegistry(),
      onAllToolCallsComplete: this.handleAllToolCallsComplete.bind(this),
      onToolCallsUpdate: this.handleToolCallsUpdate.bind(this),
      outputUpdateHandler: this.handleOutputUpdate.bind(this),
      approvalMode: ApprovalMode.DEFAULT,
      getPreferredEditor: () => 'vscode',
      config: config.getConfig()
    });
  }
  
  private async handleStreamingChat(message: string, res: express.Response) {
    const turn = new Turn(this.chat);
    
    for await (const event of turn.run([{ text: message }], this.abortController!.signal)) {
      switch (event.type) {
        case GeminiEventType.Content:
          res.write(event.value);
          break;
          
        case GeminiEventType.ToolCallRequest:
          // 直接使用 CoreToolScheduler 处理
          await this.toolScheduler.schedule(event.value, this.abortController!.signal);
          break;
          
        case GeminiEventType.ToolCallResponse:
          // 处理工具调用响应
          break;
      }
    }
  }
  
  // 处理工具调用完成
  private handleAllToolCallsComplete(completedCalls: CompletedToolCall[]) {
    // 将完成的工具调用响应发送回 Gemini
    this.submitToolResponsesToGemini(completedCalls);
  }
  
  // 处理工具调用状态更新
  private handleToolCallsUpdate(toolCalls: ToolCall[]) {
    // 通知前端状态更新
    this.notifyFrontendToolCallsUpdate(toolCalls);
  }
  
  // 处理输出更新
  private handleOutputUpdate(callId: string, outputChunk: string) {
    // 实时更新工具执行输出
    this.notifyFrontendOutputUpdate(callId, outputChunk);
  }
}
```

### 2. 改进工具确认 API

#### 当前实现
```typescript
public async handleToolConfirmation(req: express.Request, res: express.Response) {
  const { callId, outcome } = req.body;
  const toolCall = this.pendingToolCalls.get(callId);
  // 简单处理...
}
```

#### 改进后的实现
```typescript
public async handleToolConfirmation(req: express.Request, res: express.Response) {
  try {
    const { callId, outcome } = req.body;
    
    // 直接使用 CoreToolScheduler 的确认机制
    const toolCall = this.toolScheduler.getToolCall(callId);
    if (!toolCall || toolCall.status !== 'awaiting_approval') {
      return res.status(404).json({ error: 'Tool call not found or not awaiting approval' });
    }
    
    // 使用 CoreToolScheduler 的 handleConfirmationResponse
    await this.toolScheduler.handleConfirmationResponse(
      callId,
      toolCall.confirmationDetails.onConfirm,
      outcome,
      this.abortController!.signal
    );
    
    res.json({
      success: true,
      message: 'Tool confirmation processed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in handleToolConfirmation:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

### 3. 前端集成改进

#### 当前实现问题
- 前端使用简单的状态管理
- 缺少与后端状态同步的机制

#### 改进方案
```typescript
// ChatService.swift 改进
class ChatService: ObservableObject {
  @Published var toolCalls: [ToolCall] = []
  @Published var pendingConfirmations: [ToolConfirmationEvent] = []
  
  private func handleToolCallsUpdate(_ toolCalls: [ToolCall]) {
    DispatchQueue.main.async {
      self.toolCalls = toolCalls
      
      // 更新待确认的工具调用
      self.pendingConfirmations = toolCalls
        .filter { $0.status == 'awaiting_approval' }
        .map { self.mapToConfirmationEvent($0) }
    }
  }
  
  private func handleOutputUpdate(callId: String, outputChunk: String) {
    DispatchQueue.main.async {
      // 更新工具调用的实时输出
      if let index = self.toolCalls.firstIndex(where: { $0.callId == callId }) {
        self.toolCalls[index].liveOutput = outputChunk
      }
    }
  }
}
```

## 实现步骤

### 第一步：重构 GeminiService

1. **集成 CoreToolScheduler**
   ```typescript
   // 在 GeminiService 构造函数中初始化
   this.toolScheduler = new CoreToolScheduler({
     toolRegistry: config.getToolRegistry(),
     onAllToolCallsComplete: this.handleAllToolCallsComplete.bind(this),
     onToolCallsUpdate: this.handleToolCallsUpdate.bind(this),
     outputUpdateHandler: this.handleOutputUpdate.bind(this),
     approvalMode: ApprovalMode.DEFAULT,
     getPreferredEditor: () => 'vscode',
     config: config.getConfig()
   });
   ```

2. **修改流式处理逻辑**
   ```typescript
   // 使用 Turn 类处理流式响应
   const turn = new Turn(this.chat);
   for await (const event of turn.run([{ text: message }], signal)) {
     // 处理各种事件类型
   }
   ```

### 第二步：改进工具确认处理

1. **移除简单的 pendingToolCalls Map**
2. **使用 CoreToolScheduler 的状态管理**
3. **实现完整的事件通知机制**

### 第三步：前端状态同步

1. **实现 WebSocket 或 Server-Sent Events**
2. **同步工具调用状态**
3. **实时更新工具执行输出**

### 第四步：测试和验证

1. **单元测试**
   - 测试 CoreToolScheduler 集成
   - 测试工具确认流程
   - 测试状态流转

2. **集成测试**
   - 测试完整的工具调用流程
   - 测试前端状态同步
   - 测试错误处理

## 关键代码示例

### 1. 完整的 GeminiService 重构

```typescript
export class GeminiService {
  private toolScheduler: CoreToolScheduler;
  private chat: GeminiChat;
  private abortController?: AbortController;
  private config: ServerConfig;
  
  constructor(config: ServerConfig) {
    this.config = config;
    this.chat = config.getGeminiChat();
    
    this.toolScheduler = new CoreToolScheduler({
      toolRegistry: config.getToolRegistry(),
      onAllToolCallsComplete: this.handleAllToolCallsComplete.bind(this),
      onToolCallsUpdate: this.handleToolCallsUpdate.bind(this),
      outputUpdateHandler: this.handleOutputUpdate.bind(this),
      approvalMode: ApprovalMode.DEFAULT,
      getPreferredEditor: () => 'vscode',
      config: config.getConfig()
    });
  }
  
  public async handleStreamingChat(message: string, res: express.Response) {
    this.abortController = new AbortController();
    
    try {
      const turn = new Turn(this.chat);
      
      for await (const event of turn.run([{ text: message }], this.abortController.signal)) {
        switch (event.type) {
          case GeminiEventType.Content:
            res.write(event.value);
            break;
            
          case GeminiEventType.ToolCallRequest:
            console.log('收到工具调用请求:', event.value);
            await this.toolScheduler.schedule(event.value, this.abortController.signal);
            break;
            
          case GeminiEventType.ToolCallResponse:
            console.log('收到工具调用响应:', event.value);
            break;
            
          case GeminiEventType.Error:
            console.error('收到错误事件:', event.value);
            res.write(`\n错误: ${event.value.error.message}\n`);
            break;
            
          case GeminiEventType.UserCancelled:
            console.log('用户取消请求');
            res.write('\n用户取消了请求。');
            res.end();
            return;
        }
      }
      
      res.end();
      
    } catch (error) {
      console.error('Error in handleStreamingChat:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  private handleAllToolCallsComplete(completedCalls: CompletedToolCall[]) {
    console.log('所有工具调用完成:', completedCalls);
    // 将完成的工具调用响应发送回 Gemini
    this.submitToolResponsesToGemini(completedCalls);
  }
  
  private handleToolCallsUpdate(toolCalls: ToolCall[]) {
    console.log('工具调用状态更新:', toolCalls);
    // 通知前端状态更新
    this.notifyFrontendToolCallsUpdate(toolCalls);
  }
  
  private handleOutputUpdate(callId: string, outputChunk: string) {
    console.log('工具输出更新:', callId, outputChunk);
    // 通知前端输出更新
    this.notifyFrontendOutputUpdate(callId, outputChunk);
  }
  
  public async handleToolConfirmation(req: express.Request, res: express.Response) {
    try {
      const { callId, outcome } = req.body;
      
      const toolCall = this.toolScheduler.getToolCall(callId);
      if (!toolCall || toolCall.status !== 'awaiting_approval') {
        return res.status(404).json({ 
          error: 'Tool call not found or not awaiting approval' 
        });
      }
      
      await this.toolScheduler.handleConfirmationResponse(
        callId,
        toolCall.confirmationDetails.onConfirm,
        outcome,
        this.abortController!.signal
      );
      
      res.json({
        success: true,
        message: 'Tool confirmation processed',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error in handleToolConfirmation:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
```

## 总结

通过这个改进方案，我们将：

1. **完全复用 gemini-cli 的成熟架构**
2. **获得完整的状态管理和事件驱动机制**
3. **提供更好的错误处理和取消支持**
4. **实现前后端状态同步**
5. **支持复杂的工具确认流程**

这个实现将大大提升我们 server 的可靠性和功能完整性。 