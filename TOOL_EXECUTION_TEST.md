# 工具调用功能测试指南

## 测试目标

验证重构后的服务器能够正确执行工具调用，并将结果发送回 Gemini 继续对话。

## 测试步骤

### 1. 启动服务器

```bash
cd packages/core
npm run dev
```

### 2. 测试简单的文件读取工具

**请求：**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "请读取 README.md 文件的内容",
    "workspacePath": "/Users/libmac/workplace/AI/gemini-cli"
  }'
```

**预期结果：**
- 服务器应该发出 `tool_call` 事件
- 服务器应该发出 `tool_confirmation` 事件
- 工具执行后应该发出 `tool_result` 事件
- Gemini 应该继续生成响应，基于文件内容

### 3. 测试目录列表工具

**请求：**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "列出当前目录的文件",
    "workspacePath": "/Users/libmac/workplace/AI/gemini-cli"
  }'
```

**预期结果：**
- 服务器应该调用 `list_directory` 工具
- 返回目录列表
- Gemini 应该基于目录内容生成响应

### 4. 测试 Shell 命令工具

**请求：**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "运行 ls -la 命令",
    "workspacePath": "/Users/libmac/workplace/AI/gemini-cli"
  }'
```

**预期结果：**
- 服务器应该发出工具确认事件
- 用户需要确认执行命令
- 命令执行后返回结果
- Gemini 应该基于命令输出生成响应

## 关键检查点

### 1. 事件流检查

确保事件按正确顺序发出：
1. `content` - 初始响应
2. `tool_call` - 工具调用请求
3. `tool_confirmation` - 工具确认
4. `tool_result` - 工具执行结果
5. `content` - 基于工具结果的后续响应
6. `complete` - 对话完成

### 2. 工具执行检查

- 工具是否被正确调度
- 工具是否实际执行
- 工具结果是否正确返回
- 错误处理是否正常工作

### 3. 对话连续性检查

- Gemini 是否能够基于工具结果继续对话
- 是否支持多轮工具调用
- 工具调用失败时是否正确处理

## 调试信息

服务器会输出详细的调试信息：

```
=== 开始流式聊天处理 ===
收到工具调用请求: { callId: "...", name: "read_file", args: {...} }
等待 1 个工具调用完成...
工具调用完成，将结果发送回 Gemini
工具响应消息: [...]
=== 流式聊天处理完成 ===
```

## 常见问题

### 1. 工具调用没有被执行

**可能原因：**
- CoreToolScheduler 没有正确初始化
- 工具注册表为空
- 工作目录路径不正确

**解决方案：**
- 检查 `initializeGeminiClient` 方法
- 验证工具注册表是否正确创建
- 确认工作目录路径存在且有权限

### 2. 工具结果没有发送回 Gemini

**可能原因：**
- `waitForAllToolCallsToComplete` 超时
- `continueConversationAfterTools` 没有正确调用
- Turn 类状态不正确

**解决方案：**
- 检查工具调用完成回调
- 验证 Turn 类实例状态
- 增加调试日志

### 3. 前端没有收到工具事件

**可能原因：**
- 事件格式不正确
- 响应头设置错误
- 前端解析逻辑有问题

**解决方案：**
- 检查 `sendStructuredEvent` 方法
- 验证 JSON 格式
- 测试前端事件处理逻辑

## 成功标准

当所有测试都通过时，你应该看到：

1. ✅ 工具调用被正确识别和调度
2. ✅ 工具实际执行并返回结果
3. ✅ 工具结果被发送回 Gemini
4. ✅ Gemini 基于工具结果继续对话
5. ✅ 前端能够正确显示工具执行过程
6. ✅ 支持多轮工具调用
7. ✅ 错误处理正常工作

## 下一步

一旦工具调用功能正常工作，我们可以：

1. 添加更多工具类型
2. 实现工具调用的用户确认界面
3. 优化性能和错误处理
4. 添加更复杂的工具调用场景测试 