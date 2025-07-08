/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Config } from './config/config.js';
import { GeminiClient } from './core/client.js';
import { AuthType, createContentGeneratorConfig } from './core/contentGenerator.js';
import { getResponseText } from './utils/generateContentResponseUtilities.js';
import { createToolRegistry } from './config/config.js';

const execAsync = promisify(exec);

export class APIServer {
  private app: express.Application;
  private port: number;
  private geminiClient?: GeminiClient;
  private config?: Config;

  constructor(port: number = 8080) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // 允许跨域请求
    this.app.use(cors());
    // 解析 JSON 请求体
    this.app.use(express.json());
    // 请求日志
    this.app.use((req, res, next) => {
      console.log(`${req.method} ${req.path}`, { 
        ip: req.ip, 
        userAgent: req.get('User-Agent') 
      });
      next();
    });
  }

  private setupRoutes() {
    // 健康检查
    this.app.get('/status', (req: express.Request, res: express.Response) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '0.1.9'
      });
    });

    // 聊天功能 - 连接到真实的 Gemini 服务
    this.app.post('/chat', (req: express.Request, res: express.Response) => {
      this.handleChat(req, res);
    });
    
    // 文件操作
    this.app.get('/list-directory', (req: express.Request, res: express.Response) => {
      this.listDirectory(req, res);
    });
    this.app.post('/read-file', (req: express.Request, res: express.Response) => {
      this.readFile(req, res);
    });
    this.app.post('/write-file', (req: express.Request, res: express.Response) => {
      this.writeFile(req, res);
    });
    
    // 命令执行
    this.app.post('/execute-command', (req: express.Request, res: express.Response) => {
      this.executeCommand(req, res);
    });

    // 错误处理中间件
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('API Error:', err);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: err.message 
      });
    });
  }

  private async initializeGeminiClient() {
    if (this.geminiClient) {
      return;
    }

    try {
      // 创建配置
      this.config = new Config({
        sessionId: `api-server-${Date.now()}`,
        targetDir: process.cwd(),
        debugMode: false,
        cwd: process.cwd(),
        model: 'gemini-2.0-flash-exp',
        proxy: process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy,
      });

      // 初始化工具注册表 - 使用反射来设置私有属性
      (this.config as any).toolRegistry = await createToolRegistry(this.config);

      // 检查环境变量中的API Key
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required');
      }

      // 创建内容生成器配置 - 使用API Key认证
      const contentGeneratorConfig = await createContentGeneratorConfig(
        'gemini-2.0-flash-exp',
        AuthType.USE_GEMINI,
        this.config
      );

      // 创建 Gemini 客户端
      this.geminiClient = new GeminiClient(this.config);
      await this.geminiClient.initialize(contentGeneratorConfig);

      console.log('Gemini client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  private async handleChat(req: express.Request, res: express.Response) {
    try {
      const { message, stream = false } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      console.log('Processing chat request', { message: message.substring(0, 100) });

      // 确保 Gemini 客户端已初始化
      await this.initializeGeminiClient();

      if (!this.geminiClient) {
        throw new Error('Gemini client not initialized');
      }

      if (stream) {
        // 流式响应
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');
        
        try {
          const chat = this.geminiClient.getChat();
          const streamResponse = await chat.sendMessageStream({ message });
          
          for await (const chunk of streamResponse) {
            const text = getResponseText(chunk);
            if (text) {
              res.write(text);
            }
          }
          res.end();
        } catch (error) {
          console.error('Stream chat error:', error);
          res.write(`\n\n错误: ${error instanceof Error ? error.message : '未知错误'}`);
          res.end();
        }
      } else {
        // 完整响应
        try {
          const chat = this.geminiClient.getChat();
          const response = await chat.sendMessage({ message });
          const responseText = getResponseText(response);
          
          res.json({ 
            response: responseText || '',
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Chat error:', error);
          res.status(500).json({ 
            error: 'Chat processing failed', 
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      console.error('Chat initialization error:', error);
      res.status(500).json({ 
        error: 'Chat initialization failed', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async listDirectory(req: express.Request, res: express.Response) {
    try {
      const { path: dirPath = '.' } = req.query;
      const fullPath = path.resolve(dirPath as string);
      
      console.log('Listing directory', { path: fullPath });
      
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      const result = items.map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'directory' : 'file',
        path: path.join(fullPath, item.name)
      }));
      
      res.json({
        path: fullPath,
        items: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('List directory error:', error);
      res.status(500).json({ 
        error: 'Failed to list directory', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async readFile(req: express.Request, res: express.Response) {
    try {
      const { path: filePath } = req.body;
      
      if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
      }

      console.log('Reading file', { path: filePath });
      
      const content = await fs.readFile(filePath, 'utf-8');
      res.json({
        path: filePath,
        content,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Read file error:', error);
      res.status(500).json({ 
        error: 'Failed to read file', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async writeFile(req: express.Request, res: express.Response) {
    try {
      const { path: filePath, content } = req.body;
      
      if (!filePath || content === undefined) {
        return res.status(400).json({ error: 'File path and content are required' });
      }

      console.log('Writing file', { path: filePath, contentLength: content.length });
      
      await fs.writeFile(filePath, content, 'utf-8');
      res.json({
        path: filePath,
        success: true,
        message: 'File written successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Write file error:', error);
      res.status(500).json({ 
        error: 'Failed to write file', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async executeCommand(req: express.Request, res: express.Response) {
    try {
      const { command, cwd } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      console.log('Executing command', { command, cwd });
      
      const { stdout, stderr } = await execAsync(command, { 
        cwd: cwd || process.cwd() 
      });
      
      res.json({
        command,
        cwd: cwd || process.cwd(),
        output: stdout,
        error: stderr,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Execute command error:', error);
      res.status(500).json({ 
        error: 'Failed to execute command', 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public start() {
    this.app.listen(this.port, () => {
      console.log(`API Server running on http://localhost:${this.port}`);
      console.log('Available endpoints:');
      console.log('  GET  /status - Health check');
      console.log('  POST /chat - Chat with Gemini (simulated)');
      console.log('  GET  /list-directory - List directory contents');
      console.log('  POST /read-file - Read file content');
      console.log('  POST /write-file - Write file content');
      console.log('  POST /execute-command - Execute shell command');
    });
  }

  public stop() {
    // 优雅关闭服务器
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