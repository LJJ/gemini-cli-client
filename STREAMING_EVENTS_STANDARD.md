# 标准化流式事件格式规范

## 概述

本文档定义了 Gemini CLI 前后端交互的标准化流式事件格式，确保数据格式的一致性和可维护性。

## 核心原则

1. **标准化**: 所有事件都遵循统一的结构
2. **类型安全**: 使用强类型定义，避免运行时错误
3. **向后兼容**: 支持现有的事件类型
4. **可扩展**: 易于添加新的事件类型

## 事件结构

所有流式事件都遵循以下基础结构：

```json
{
  "type": "事件类型",
  "data": {
    // 具体的事件数据
  },
  "timestamp": "ISO 8601 时间戳"
}
```

## 支持的事件类型

### 1. Content 事件
**用途**: 发送文本内容片段

```json
{
  "type": "content",
  "data": {
    "text": "正在处理您的请求...",
    "isPartial": true
  },
  "timestamp": "2025-07-09T10:27:52.699Z"
}
```

### 2. Thought 事件
**用途**: 显示 AI 的思考过程

```json
{
  "type": "thought",
  "data": {
    "subject": "Considering a Response",
    "description": "I'm analyzing the user's request..."
  },
  "timestamp": "2025-07-09T10:23:42.369Z"
}
```

### 3. Tool Call 事件
**用途**: 通知工具调用请求

```json
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
  "timestamp": "2025-07-09T10:30:02.000Z"
}
```

### 4. Tool Execution 事件
**用途**: 显示工具执行状态

```json
{
  "type": "tool_execution",
  "data": {
    "callId": "read-123",
    "status": "executing",
    "message": "正在执行 read_file..."
  },
  "timestamp": "2025-07-09T10:30:03.000Z"
}
```

### 5. Tool Result 事件
**用途**: 显示工具执行结果

```json
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
  "timestamp": "2025-07-09T10:30:04.000Z"
}
```

### 6. Tool Confirmation 事件
**用途**: 请求用户确认工具调用

```json
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
  "timestamp": "2025-07-09T10:30:02.000Z"
}
```

### 7. Complete 事件
**用途**: 标记对话完成

```json
{
  "type": "complete",
  "data": {
    "success": true,
    "message": "对话完成"
  },
  "timestamp": "2025-07-09T10:30:06.000Z"
}
```

### 8. Error 事件
**用途**: 报告错误信息

```json
{
  "type": "error",
  "data": {
    "message": "发生错误",
    "code": "ERROR_CODE",
    "details": "详细错误信息"
  },
  "timestamp": "2025-07-09T10:30:03.000Z"
}
```

## 实现文件

### 后端 (TypeScript)
- `packages/core/src/server/types/streaming-events.ts` - 类型定义和工厂函数
- `packages/core/src/server/GeminiService.ts` - 使用标准化格式发送事件

### 前端 (Swift)
- `GeminiForMac/GeminiForMac/Models/StreamEvent.swift` - 事件模型定义
- `GeminiForMac/GeminiForMac/Services/ChatService.swift` - 事件处理逻辑

## 测试验证

我们创建了测试文件来验证标准化格式：

- `test_standardized_events.swift` - 验证所有事件类型的解析
- `test_stream_event_parsing.swift` - 原始测试文件

## 兼容性

### 向后兼容
- 支持现有的所有事件类型
- 保持现有的字段名称和结构
- 新增字段为可选，不影响现有功能

### 向前兼容
- 使用类型安全的枚举定义事件类型
- 提供工厂函数简化事件创建
- 支持事件验证和类型检查

## 使用示例

### 后端发送事件
```typescript
import { StreamingEventFactory } from './types/streaming-events.js';

// 发送内容事件
const contentEvent = StreamingEventFactory.createContentEvent(
  "正在处理您的请求...", 
  true
);

// 发送思考事件
const thoughtEvent = StreamingEventFactory.createThoughtEvent(
  "Considering a Response",
  "I'm analyzing the user's request..."
);
```

### 前端解析事件
```swift
// 解析事件
if let event = StreamEvent.parse(from: jsonString) {
    switch event.data {
    case .content(let data):
        print("收到内容: \(data.text)")
    case .thought(let data):
        print("思考过程: \(data.subject)")
    // ... 其他事件类型
    }
}
```

## 最佳实践

1. **始终使用工厂函数**: 使用 `StreamingEventFactory` 创建事件，确保格式正确
2. **验证事件**: 在解析前验证事件的完整性
3. **错误处理**: 为每种事件类型提供适当的错误处理
4. **日志记录**: 记录事件发送和接收的日志，便于调试
5. **类型检查**: 使用类型守卫函数检查事件类型

## 未来扩展

当需要添加新的事件类型时：

1. 在 `EventType` 枚举中添加新类型
2. 定义对应的事件数据结构
3. 在工厂函数中添加创建方法
4. 更新前端的事件处理逻辑
5. 更新文档和测试

这种标准化方法确保了前后端数据格式的一致性，避免了 case by case 的修复，提高了代码的可维护性和可扩展性。 