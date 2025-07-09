# CodeAssist 降级测试指南

## 测试目标

验证当 CodeAssist 服务不可用时，服务器能够自动降级到普通的 Gemini API，确保基本功能正常工作。

## 问题描述

当 CodeAssist 服务不可用时（如网络问题、服务不可用等），会出现以下错误：
```
Failed to initialize Gemini client: GaxiosError: request to https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist failed, reason: read ECONNRESET
```

## 修复方案

### 1. 添加降级逻辑

在 `GeminiService.initializeGeminiClient()` 方法中添加了降级处理：

```typescript
try {
  // 尝试初始化 CodeAssist
  console.log('尝试初始化 CodeAssist...');
  await this.geminiClient.initialize(contentGeneratorConfig);
  console.log('CodeAssist 初始化成功');
} catch (codeAssistError) {
  console.warn('CodeAssist 初始化失败，降级到普通 Gemini API:', codeAssistError);
  
  // 如果 CodeAssist 初始化失败，尝试使用普通的 Gemini API
  try {
    console.log('尝试使用普通 Gemini API...');
    
    // 获取不包含 CodeAssist 的配置
    const fallbackConfig = await this.authService.getContentGeneratorConfig(true);
    
    await this.geminiClient.initialize(fallbackConfig);
    console.log('普通 Gemini API 初始化成功');
  } catch (fallbackError) {
    console.error('普通 Gemini API 也初始化失败:', fallbackError);
    throw new Error(`Gemini 客户端初始化失败: ${fallbackError.message}`);
  }
}
```

### 2. 修改 AuthService

在 `AuthService.getContentGeneratorConfig()` 方法中添加了 `disableCodeAssist` 参数：

```typescript
public async getContentGeneratorConfig(disableCodeAssist: boolean = false) {
  // ... 现有逻辑 ...
  
  // 如果禁用 CodeAssist，移除相关配置
  if (disableCodeAssist) {
    console.log('禁用 CodeAssist 配置');
    return {
      ...config,
      codeAssist: undefined
    };
  }
  
  return config;
}
```

## 测试步骤

### 1. 模拟 CodeAssist 不可用

可以通过以下方式模拟 CodeAssist 不可用：

**方法一：网络断开**
```bash
# 临时断开网络连接
sudo ifconfig en0 down

# 启动服务器
npm run dev

# 发送测试请求
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# 恢复网络连接
sudo ifconfig en0 up
```

**方法二：代理问题**
```bash
# 设置错误的代理
export HTTPS_PROXY=http://invalid-proxy:8080

# 启动服务器
npm run dev
```

### 2. 检查日志输出

正常情况下的日志应该显示：

```
Setting workspace directory to: /Users/libmac/workplace/AI/gemini-cli
尝试初始化 CodeAssist...
CodeAssist 初始化失败，降级到普通 Gemini API: GaxiosError: ...
尝试使用普通 Gemini API...
禁用 CodeAssist 配置
普通 Gemini API 初始化成功
Gemini client initialized successfully
```

### 3. 验证功能

即使 CodeAssist 不可用，以下功能应该仍然正常工作：

- ✅ 基本的文本对话
- ✅ 文件读取工具 (`read_file`)
- ✅ 目录列表工具 (`list_directory`)
- ✅ 文件写入工具 (`write_file`)
- ✅ Shell 命令执行 (`run_shell_command`)
- ✅ 其他内置工具

### 4. 测试工具调用

```bash
# 测试文件读取
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "请读取 README.md 文件",
    "workspacePath": "/Users/libmac/workplace/AI/gemini-cli"
  }'

# 测试目录列表
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "列出当前目录的文件",
    "workspacePath": "/Users/libmac/workplace/AI/gemini-cli"
  }'
```

## 预期结果

### 成功场景

1. **CodeAssist 可用时**：
   - 正常使用 CodeAssist 功能
   - 日志显示 "CodeAssist 初始化成功"

2. **CodeAssist 不可用时**：
   - 自动降级到普通 Gemini API
   - 基本功能正常工作
   - 日志显示降级过程

### 失败场景

如果两种方式都失败，会抛出明确的错误信息：
```
Gemini 客户端初始化失败: [具体错误信息]
```

## 注意事项

1. **功能差异**：降级后可能无法使用 CodeAssist 特有的功能
2. **性能影响**：普通 Gemini API 可能在代码相关任务上表现不如 CodeAssist
3. **错误处理**：确保错误信息清晰，便于用户理解问题

## 调试技巧

如果遇到问题，可以：

1. **检查网络连接**：确保能够访问 Gemini API
2. **验证认证配置**：确保 API Key 或 OAuth 凭据有效
3. **查看详细日志**：服务器会输出详细的初始化过程
4. **测试基本功能**：先测试简单的文本对话，再测试工具调用

## 总结

这个修复确保了即使在 CodeAssist 服务不可用的情况下，用户仍然可以使用 Gemini CLI 的基本功能，提高了系统的可靠性和用户体验。 