# Server 模块重构说明

## 目录结构

根据SOLID原则和单一职责原则，server模块已重新组织为以下结构：

```
server/
├── auth/           # 认证相关服务
│   ├── index.ts
│   ├── AuthService.ts      # 主要认证服务
│   ├── AuthConfigManager.ts # 认证配置管理
│   ├── OAuthManager.ts     # OAuth流程管理
│   └── AuthValidator.ts    # 认证验证
├── chat/           # 聊天相关服务
│   ├── index.ts
│   ├── ChatHandler.ts      # 聊天消息处理
│   └── StreamingEventService.ts # 流式事件服务
├── tools/          # 工具相关服务
│   ├── index.ts
│   ├── ToolOrchestrator.ts # 工具协调器
│   └── CommandService.ts   # 命令执行服务
├── files/          # 文件相关服务
│   ├── index.ts
│   └── FileService.ts      # 文件操作服务
├── core/           # 核心服务
│   ├── index.ts
│   ├── GeminiService.ts    # 主要协调服务
│   ├── ClientManager.ts    # 客户端管理
│   └── ServerConfig.ts     # 服务器配置
├── types/          # 类型定义
│   └── streaming-events.ts
├── utils/          # 工具类
│   └── responseFactory.ts
├── docs/           # 文档
└── index.ts        # 主入口文件
```

## 职责分离

### Auth 模块 (认证)
- **AuthService**: 认证流程协调，HTTP请求处理，认证状态管理
- **AuthConfigManager**: 认证配置的持久化和加载
- **OAuthManager**: OAuth流程的具体实现
- **AuthValidator**: 认证参数的验证

### Chat 模块 (聊天)
- **ChatHandler**: 聊天消息处理，流式响应管理，事件分发
- **StreamingEventService**: 结构化事件创建和发送

### Tools 模块 (工具)
- **ToolOrchestrator**: 工具调用的调度和状态管理
- **CommandService**: 命令执行服务

### Files 模块 (文件)
- **FileService**: 文件读写、目录列表等文件操作

### Core 模块 (核心)
- **GeminiService**: 服务组合和协调，HTTP请求处理
- **ClientManager**: Gemini客户端初始化和管理
- **ServerConfig**: 服务器配置管理

## 设计原则

1. **单一职责原则**: 每个文件只负责一个特定的功能领域
2. **开闭原则**: 通过接口和抽象类支持扩展
3. **依赖倒置**: 高层模块不依赖低层模块，都依赖抽象
4. **接口隔离**: 客户端不应该依赖它不需要的接口
5. **组合优于继承**: 使用组合来构建复杂功能

## 导入方式

```typescript
// 导入特定模块
import { AuthService } from './auth/index.js';
import { ChatHandler } from './chat/index.js';
import { ToolOrchestrator } from './tools/index.js';

// 或者从主入口导入
import { AuthService, ChatHandler, ToolOrchestrator } from './index.js';
```

## 重构优势

1. **更好的可维护性**: 相关功能集中在同一目录
2. **更清晰的职责**: 每个文件都有明确的单一职责
3. **更容易测试**: 可以独立测试每个模块
4. **更好的扩展性**: 新功能可以添加到相应的模块中
5. **减少耦合**: 模块间通过明确的接口进行交互 