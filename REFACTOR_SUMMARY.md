# Gemini CLI 服务器重构总结

## 重构目标

将服务器端的响应处理逻辑与 gemini-cli 保持一致，让 AI 自动决定是否需要交互式处理，而不是由客户端指定。

## 主要变更

### 1. 移除 `stream` 参数

**之前：**
```typescript
// 客户端可以指定是否使用流式响应
const { message, stream = false, filePaths = [], workspacePath } = req.body;

if (stream) {
  await this.handleStreamingChat(fullMessage, res);
} else {
  // 完整响应处理
}
```

**现在：**
```typescript
// 统一使用流式响应，让 AI 自动决定
const { message, filePaths = [], workspacePath } = req.body;

// 统一使用流式响应，让 AI 自动决定是否需要交互式处理
await this.handleStreamingChat(fullMessage, res);
```

### 2. 使用 Turn 类处理流式响应

**之前：**
- 手动处理流式响应
- 复杂的工具调用循环
- 重复的代码逻辑

**现在：**
```typescript
// 使用 Turn 类处理流式响应，与 gemini-cli 保持一致
const messageParts = [{ text: message }];

for await (const event of this.currentTurn.run(messageParts, this.abortController.signal)) {
  switch (event.type) {
    case GeminiEventType.Content:
      // 发送文本内容
      break;
    case GeminiEventType.ToolCallRequest:
      // 处理工具调用请求
      break;
    case GeminiEventType.Thought:
      // 处理思考过程
      break;
    // ... 其他事件类型
  }
}
```

### 3. 支持更多事件类型

现在支持 gemini-cli 中的所有事件类型：
- `Content`: 文本内容
- `Thought`: AI 思考过程
- `ToolCallRequest`: 工具调用请求
- `ToolCallResponse`: 工具调用响应
- `Error`: 错误信息
- `UserCancelled`: 用户取消
- `ChatCompressed`: 聊天压缩

### 4. 前端应用更新

**Swift 应用：**
- 移除 `stream` 参数
- 统一使用流式响应
- 移除对非流式响应的回退处理

## 设计理念

### 为什么这样设计？

1. **AI 知道任务需求**：只有 AI 模型知道当前任务是否需要交互式处理（如工具调用、用户确认等）

2. **简化客户端逻辑**：客户端不需要判断任务类型，只需要展示结果

3. **与 gemini-cli 保持一致**：使用相同的核心逻辑，确保行为一致性

4. **更好的用户体验**：流式响应提供实时反馈，用户可以看到 AI 的思考过程

### 与 gemini-cli 的对比

**gemini-cli 的判断逻辑：**
```typescript
// 基于终端环境和输入方式
if (process.stdin.isTTY && input?.length === 0) {
  // 交互式模式：有 TTY 且没有命令行输入
  render(<AppWrapper />);
} else {
  // 非交互式模式：无 TTY 或有命令行输入
  await runNonInteractive(nonInteractiveConfig, input);
}
```

**我们的服务器：**
```typescript
// 统一使用流式响应，AI 自动决定
await this.handleStreamingChat(fullMessage, res);
```

## 优势

1. **一致性**：与 gemini-cli 核心逻辑保持一致
2. **简化**：减少客户端和服务器的复杂性
3. **灵活性**：AI 可以根据任务需求自动调整处理方式
4. **可扩展性**：支持更多事件类型和功能

## 注意事项

1. **向后兼容性**：移除了 `stream` 参数，需要更新客户端代码
2. **错误处理**：统一使用结构化错误事件
3. **工具调用**：支持完整的工具调用生命周期
4. **性能**：流式响应可能增加网络开销，但提供更好的用户体验

## 测试建议

1. 测试不同类型的任务（简单问答、工具调用、文件处理等）
2. 验证工具调用确认流程
3. 测试错误处理和用户取消
4. 确认前端应用正确解析结构化事件 