# Server 开发文档

## 概述

本目录包含了我们 server 开发的指导文档，特别是关于工具确认机制的实现原理和最佳实践。

## 文档结构

### 1. [工具确认机制架构文档](./tool-confirmation-architecture.md)

详细描述了 gemini-cli 中工具确认机制的实现原理和架构设计，包括：

- **核心架构组件**: CoreToolScheduler、Turn、useReactToolScheduler
- **工具调用状态流转**: 完整的状态定义和流转图
- **确认机制详解**: 触发条件、确认类型、确认结果
- **事件驱动架构**: 事件类型和回调机制
- **实现原理**: 关键代码示例和流程说明
- **最佳实践**: 状态管理、错误处理、事件通知、工具实现

### 2. [实现指南](./implementation-guide.md)

提供了将 gemini-cli 工具确认机制集成到我们 server 的具体实现指南，包括：

- **当前实现分析**: 现有架构和需要改进的地方
- **改进方案**: 重构 GeminiService、改进工具确认 API、前端集成改进
- **实现步骤**: 详细的四步实现计划
- **关键代码示例**: 完整的重构代码示例

## 核心概念

### 工具确认机制

gemini-cli 的工具确认机制是一个设计完善的系统，具有以下特点：

1. **分层架构**: 核心逻辑与 UI 逻辑分离
2. **状态驱动**: 清晰的状态流转和事件通知
3. **类型安全**: 完整的 TypeScript 类型定义
4. **可扩展性**: 支持多种确认类型和结果
5. **错误处理**: 完善的错误处理和取消机制

### 关键组件

- **CoreToolScheduler**: 工具调用的核心调度器
- **Turn**: 管理与 Gemini API 的对话轮次
- **useReactToolScheduler**: React Hook 适配器

### 状态流转

```
validating → awaiting_approval → scheduled → executing → success/error/cancelled
     ↓              ↓              ↓           ↓
  工具验证      用户确认      等待执行      执行工具
```

## 开发指导原则

### 1. 复用优先

我们应该完全复用 gemini-cli 的以下组件：
- `CoreToolScheduler` - 核心调度逻辑
- `Turn` - 对话管理
- 工具确认机制和状态管理

### 2. 保持一致性

- 使用相同的事件驱动模式
- 保持状态管理的一致性
- 遵循相同的错误处理模式

### 3. 适配 Web 环境

- 将 Web API 请求适配到 CoreToolScheduler 的接口
- 实现前端确认 UI 与后端状态同步
- 添加 Web 特定的安全机制

## 快速开始

### 1. 阅读架构文档

首先阅读 [工具确认机制架构文档](./tool-confirmation-architecture.md) 了解整体架构。

### 2. 查看实现指南

然后查看 [实现指南](./implementation-guide.md) 了解具体的实现步骤。

### 3. 开始实现

按照实现指南中的步骤，逐步重构我们的 server 实现。

## 相关文件

### Server 模块结构
- `packages/core/src/server/auth/` - 认证相关服务（AuthService、AuthConfigManager、OAuthManager、AuthValidator）
- `packages/core/src/server/chat/` - 聊天与流式事件服务（ChatHandler、StreamingEventService）
- `packages/core/src/server/tools/` - 工具与命令服务（ToolOrchestrator、CommandService）
- `packages/core/src/server/files/` - 文件操作服务（FileService）
- `packages/core/src/server/core/` - 核心服务（GeminiService、ClientManager、ServerConfig）
- `packages/core/src/server/types/` - 类型定义
- `packages/core/src/server/utils/` - 工具类

### 核心组件
- `packages/core/src/core/coreToolScheduler.ts` - 核心调度器实现
- `packages/core/src/core/turn.ts` - 对话轮次管理
- `packages/cli/src/ui/hooks/useReactToolScheduler.ts` - React Hook 适配器

## 注意事项

1. **不要重新发明轮子**: 充分利用 gemini-cli 的成熟实现
2. **保持类型安全**: 使用完整的 TypeScript 类型定义
3. **测试驱动**: 为每个组件编写充分的测试
4. **文档同步**: 及时更新文档以反映实现变化

## 贡献指南

当修改 server 实现时，请：

1. 更新相关文档
2. 添加必要的测试
3. 确保向后兼容性
4. 遵循现有的代码风格 