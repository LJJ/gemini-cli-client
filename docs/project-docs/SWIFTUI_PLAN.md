# Gemini CLI SwiftUI 前端开发计划

## 项目概述

为 Gemini CLI 添加 SwiftUI 前端，提供原生 macOS 应用体验，同时保持与现有 CLI 版本的兼容性。

**目标**: 创建一个原生的 SwiftUI macOS 应用作为前端，与一个在后台运行、无沙盒限制的 Node.js 服务器进行通信，以充分利用 gemini-cli 的全部功能。

## 架构设计

### 1. 整体架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SwiftUI App   │    │   CLI Package   │    │   Core Package  │
│   (macOS)       │    │   (Terminal)    │    │   (Backend)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   HTTP API      │
                    │   (Express)     │
                    └─────────────────┘
```

### 2. 技术栈选择
- **前端**: SwiftUI + Combine + URLSession
- **后端**: 扩展现有的 Node.js Core 包 + Express
- **通信**: HTTP REST API
- **构建工具**: Xcode + Swift Package Manager

## 分阶段开发计划

### 第一阶段：后端改造 - 将 `gemini-cli` 核心逻辑 API 化

**目标**: 将 gemini-cli 的核心功能通过一个本地 HTTP 服务器暴露出来。这是整个项目的基础。

#### 1.1 安装依赖

**说明**: 我们需要为 Node.js 后端添加 HTTP 服务器功能。Express 是最流行的 Node.js Web 框架，CORS 用于处理跨域请求。

```bash
# 在 packages/core 目录下执行
npm install express cors
npm install @types/express @types/cors --save-dev
```

**依赖说明**:
- `express`: Node.js Web 应用框架，类似 Swift 的 Vapor
- `cors`: 跨域资源共享中间件，允许前端应用访问后端 API
- `@types/express`, `@types/cors`: TypeScript 类型定义，提供类型安全

#### 1.2 创建服务器文件
- 在 `packages/core/src/` 目录下创建 `server.ts`
- 这将是我们的 HTTP 服务器入口

#### 1.3 实现基础服务器

**说明**: 这个服务器类封装了 Express 应用，提供了 HTTP API 接口。类似 Swift 中的 App 结构，但用于处理 HTTP 请求而不是 UI。

```typescript
// packages/core/src/server.ts
import express from 'express';
import cors from 'cors';
import { Core } from './core';

export class APIServer {
  private app: express.Application;  // Express 应用实例，类似 Swift 的 App
  private core: Core;                // 现有的 Gemini CLI 核心功能
  private port: number;              // 服务器端口

  constructor(port: number = 8080) {
    this.app = express();            // 创建 Express 应用
    this.port = port;
    this.core = new Core();          // 初始化现有的核心功能
    this.setupMiddleware();          // 设置中间件
    this.setupRoutes();              // 设置路由
  }

  private setupMiddleware() {
    // 中间件：处理请求前的逻辑，类似 Swift 的 ViewModifier
    this.app.use(cors());            // 允许跨域请求
    this.app.use(express.json());    // 解析 JSON 请求体
  }

  private setupRoutes() {
    // 路由：定义 API 端点，类似 SwiftUI 的 NavigationView
    this.app.get('/status', (req, res) => {
      // GET 请求处理器，类似 Swift 的 GET 方法
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // 聊天功能
    this.app.post('/chat', this.handleChat.bind(this));
    
    // 文件操作
    this.app.get('/list-directory', this.listDirectory.bind(this));
    this.app.post('/read-file', this.readFile.bind(this));
    this.app.post('/write-file', this.writeFile.bind(this));
    
    // 命令执行
    this.app.post('/execute-command', this.executeCommand.bind(this));
  }

  public start() {
    // 启动服务器，类似 Swift 的 App.main()
    this.app.listen(this.port, () => {
      console.log(`API Server running on http://localhost:${this.port}`);
    });
  }
}
```

**关键概念解释**:
- `express.Application`: Express 应用实例，管理 HTTP 服务器
- `middleware`: 中间件，在请求处理前执行的函数
- `routes`: 路由，定义 URL 路径和对应的处理函数
- `req, res`: 请求和响应对象，类似 Swift 的 URLRequest 和 URLResponse

#### 1.4 暴露核心功能
实现以下 API 端点：

- `POST /chat` - 接收用户输入，返回 Gemini 的流式或完整响应
- `POST /execute-command` - 接收 shell 命令并执行，返回输出
- `GET /list-directory` - 接收路径，返回目录内容
- `POST /read-file` - 接收文件路径，返回文件内容
- `POST /write-file` - 接收文件路径和内容，写入文件

#### 1.5 添加启动脚本
在 `packages/core/package.json` 中添加：
```json
{
  "scripts": {
    "start:server": "node ./dist/server.js"
  }
}
```

### 第二阶段：前端搭建 - 创建 SwiftUI 应用骨架

**目标**: 创建一个基础的 macOS 应用，并搭建好与后端通信的准备工作。

#### 2.1 创建 Xcode 项目
- 项目名称: `GeminiNativeClient`
- Interface: SwiftUI
- Language: Swift
- 位置: `swiftui-app/` 目录

#### 2.2 设计基础 UI
```swift
// swiftui-app/Sources/Views/ContentView.swift
struct ContentView: View {
    @StateObject private var chatService = ChatService()
    @State private var messageText = ""
    @State private var isConnected = false
    
    var body: some View {
        VStack {
            // 状态指示器
            HStack {
                Circle()
                    .fill(isConnected ? Color.green : Color.red)
                    .frame(width: 10, height: 10)
                Text(isConnected ? "已连接" : "未连接")
                    .font(.caption)
            }
            .padding()
            
            // 聊天区域
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    ForEach(chatService.messages) { message in
                        MessageView(message: message)
                    }
                }
                .padding()
            }
            
            // 输入区域
            HStack {
                TextField("输入消息...", text: $messageText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                
                Button("发送") {
                    Task {
                        await chatService.sendMessage(messageText)
                        messageText = ""
                    }
                }
                .disabled(messageText.isEmpty)
            }
            .padding()
        }
        .onAppear {
            Task {
                await chatService.checkConnection()
            }
        }
    }
}
```

#### 2.3 创建网络服务层
```swift
// swiftui-app/Sources/Services/APIService.swift
class APIService: ObservableObject {
    private let baseURL = "http://localhost:8080"
    
    func checkServerStatus() async -> Bool {
        guard let url = URL(string: "\(baseURL)/status") else { return false }
        
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(StatusResponse.self, from: data)
            return response.status == "ok"
        } catch {
            print("服务器状态检查失败: \(error)")
            return false
        }
    }
    
    func sendMessage(_ text: String) async -> ChatResponse? {
        guard let url = URL(string: "\(baseURL)/chat") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ChatRequest(message: text)
        request.httpBody = try? JSONEncoder().encode(body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try JSONDecoder().decode(ChatResponse.self, from: data)
        } catch {
            print("发送消息失败: \(error)")
            return nil
        }
    }
}

// 数据模型
struct StatusResponse: Codable {
    let status: String
    let timestamp: String
}

struct ChatRequest: Codable {
    let message: String
}

struct ChatResponse: Codable {
    let response: String
    let timestamp: String
}
```

### 第三阶段：前后端集成与功能实现

**目标**: 将 UI 操作与后端 API 连接起来，实现核心功能。

#### 3.1 连接验证
- 应用启动时自动检查服务器状态
- UI 显示连接状态指示器
- 自动重连机制

#### 3.2 实现核心聊天功能
- 消息发送和接收
- 实时响应显示
- 消息历史记录

#### 3.3 实现文件和命令操作
- 文件树侧边栏
- 文件内容查看和编辑
- 命令执行界面

### 第四阶段：打包与优化

**目标**: 让应用易于启动和使用，并进行体验优化。

#### 4.1 简化启动流程
创建启动脚本 `start-app.sh`:
```bash
#!/bin/bash
# 启动 Node.js 服务器
cd packages/core
npm run start:server &
SERVER_PID=$!

# 等待服务器启动
sleep 2

# 打开 macOS 应用
open swiftui-app/build/GeminiNativeClient.app

# 清理函数
cleanup() {
    kill $SERVER_PID
    exit 0
}

trap cleanup SIGINT SIGTERM

# 保持脚本运行
wait
```

#### 4.2 优化用户体验
- 加载指示器
- 错误处理和用户提示
- 自定义应用图标
- 键盘快捷键支持

## 项目结构

```
gemini-cli/
├── packages/
│   ├── cli/           # 现有 CLI 包
│   ├── core/          # 现有 Core 包 (扩展 API)
│   │   ├── src/
│   │   │   ├── server.ts    # 新增 API 服务器
│   │   │   ├── api/         # API 路由和处理器
│   │   │   └── ...
│   │   └── package.json     # 添加 express 依赖
│   └── swiftui/       # SwiftUI 相关配置
├── swiftui-app/       # Xcode 项目
│   ├── GeminiNativeClient.xcodeproj
│   ├── Sources/
│   │   ├── App/
│   │   ├── Views/
│   │   ├── Models/
│   │   ├── Services/
│   │   └── Utils/
│   ├── Tests/
│   └── Resources/
├── scripts/
│   └── start-app.sh   # 启动脚本
└── docs/
    └── swiftui/       # SwiftUI 相关文档
```

## 开发时间线

- **第 1 周**: 第一阶段 - 后端 API 开发
- **第 2-3 周**: 第二阶段 - SwiftUI 基础框架
- **第 4-5 周**: 第三阶段 - 功能集成
- **第 6 周**: 第四阶段 - 优化和打包

## 技术实现要点

### 1. 后端 API 设计
- RESTful API 设计
- 错误处理和状态码
- 请求/响应数据格式标准化
- 安全性考虑 (CORS, 输入验证)

### 2. SwiftUI 最佳实践
- MVVM 架构模式
- Combine 框架用于响应式编程
- 异步操作处理
- 内存管理

### 3. 集成考虑
- 本地服务器管理
- 错误处理和重试机制
- 用户体验优化
- 性能监控

## 下一步行动

1. **立即开始第一阶段**: 安装依赖并创建 API 服务器
2. **设置开发环境**: 准备 Xcode 和 Node.js 环境
3. **创建项目结构**: 建立目录和基础文件
4. **开始编码**: 从最简单的状态检查开始

这个计划将宏大的目标分解成了具体、可执行的小任务，每个阶段都有明确的目标和可验证的成果。 