/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServerConfig } from './server/core/ServerConfig.js';
import { GeminiService } from './server/core/GeminiService.js';
import { FileService } from './server/files/FileService.js';
import { CommandService } from './server/tools/CommandService.js';
import { AuthService } from './server/auth/AuthService.js';

export class APIServer {
  private serverConfig: ServerConfig;
  private geminiService: GeminiService;
  private fileService: FileService;
  private commandService: CommandService;
  private authService: AuthService;

  constructor(port: number = 8080) {
    this.serverConfig = new ServerConfig(port);
    this.authService = new AuthService();
    this.geminiService = new GeminiService(this.authService);
    this.fileService = new FileService();
    this.commandService = new CommandService();
    
    this.setupRoutes();
    this.serverConfig.addErrorHandler();
  }

  private setupRoutes() {
    const app = this.serverConfig.getApp();

    // 健康检查
    app.get('/status', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '0.1.9'
      });
    });

    // 认证功能
    app.post('/auth/config', (req, res) => {
      this.authService.handleAuthConfig(req, res);
    });
    
    app.post('/auth/google-login', (req, res) => {
      this.authService.handleGoogleLogin(req, res);
    });
    
    app.get('/auth/status', (req, res) => {
      this.authService.handleAuthStatus(req, res);
    });
    
    app.post('/auth/logout', (req, res) => {
      this.authService.handleLogout(req, res);
    });
    
    app.post('/auth/clear', (req, res) => {
      this.authService.handleClearAuth(req, res);
    });
    

    
    // 聊天功能 - 连接到真实的 Gemini 服务
    app.post('/chat', (req, res) => {
      this.geminiService.handleChat(req, res);
    });
    
    // 工具确认功能
    app.post('/tool-confirmation', (req, res) => {
      this.geminiService.handleToolConfirmation(req, res);
    });
    
    // 文件操作
    app.get('/list-directory', (req, res) => {
      this.fileService.listDirectory(req, res);
    });
    app.post('/read-file', (req, res) => {
      this.fileService.readFile(req, res);
    });
    app.post('/write-file', (req, res) => {
      this.fileService.writeFile(req, res);
    });
    
    // 命令执行
    app.post('/execute-command', (req, res) => {
      this.commandService.executeCommand(req, res);
    });
  }

  public start() {
    const app = this.serverConfig.getApp();
    const port = this.serverConfig.getPort();
    
    app.listen(port, () => {
      console.log(`🚀 Gemini CLI API Server is running on port ${port}`);
      console.log(`📡 Health check: http://localhost:${port}/status`);
      console.log(`🔐 Auth endpoints: http://localhost:${port}/auth/*`);
      console.log(`💬 Chat endpoint: http://localhost:${port}/chat`);
      console.log(`📁 File operations: http://localhost:${port}/list-directory`);
      console.log(`⚡ Command execution: http://localhost:${port}/execute-command`);
    });
  }

  public stop() {
    console.log('🛑 Stopping Gemini CLI API Server...');
    process.exit(0);
  }
}

// 如果直接运行此文件，启动服务器
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = new APIServer(port);
  server.start();

  // 处理优雅关闭
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    server.stop();
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    server.stop();
  });
} 