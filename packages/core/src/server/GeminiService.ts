/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config, GeminiClient } from '../index.js';
import { Turn, ServerGeminiStreamEvent, GeminiEventType } from '../core/turn.js';
import { CoreToolScheduler, CompletedToolCall, ToolCall } from '../core/coreToolScheduler.js';
import { ToolCallRequestInfo, ToolCallResponseInfo } from '../core/turn.js';
import { ApprovalMode, createToolRegistry } from '../config/config.js';
import { createContentGeneratorConfig, AuthType } from '../core/contentGenerator.js';
import { AuthService } from './AuthService.js';
import express from 'express';
import { ResponseFactory } from './utils/responseFactory.js';

export class GeminiService {
  private geminiClient: GeminiClient | null = null;
  private config: Config | null = null;
  private toolScheduler: CoreToolScheduler | null = null;
  private currentTurn: Turn | null = null;
  private abortController: AbortController | null = null;
  private currentResponse: express.Response | null = null;
  private authService: AuthService;

  constructor(authService?: AuthService) {
    this.authService = authService || new AuthService();
  }

  public async initializeGeminiClient(workspacePath?: string) {
    // 每次都重新初始化客户端以确保工作目录正确
    this.geminiClient = null;
    this.config = null;

    try {
      // 创建配置
      const workspaceDir = workspacePath || process.env.GEMINI_WORKSPACE || process.env.HOME || '/Users/libmac';
      console.log('Setting workspace directory to:', workspaceDir);
      
      this.config = new Config({
        sessionId: `api-server-${Date.now()}`,
        targetDir: workspaceDir, // 使用传入的工作目录
        debugMode: false,
        cwd: workspaceDir, // 使用传入的工作目录
        model: 'gemini-2.5-flash', // 使用支持的模型名称
        proxy: process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy,
      });

      // 初始化工具注册表 - 使用反射来设置私有属性
      (this.config as any).toolRegistry = await createToolRegistry(this.config);

      // 检查认证状态
      if (!this.authService.isUserAuthenticated()) {
        throw new Error('用户未认证，请先完成认证设置');
      }

      // 使用认证服务获取内容生成器配置
      const contentGeneratorConfig = await this.authService.getContentGeneratorConfig();

      // 创建 Gemini 客户端
      this.geminiClient = new GeminiClient(this.config);
      await this.geminiClient.initialize(contentGeneratorConfig);

      console.log('Gemini client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  public async handleChat(req: express.Request, res: express.Response) {
    try {
      const { message, stream = false, filePaths = [], workspacePath } = req.body;
      
      if (!message) {
        return res.status(400).json(ResponseFactory.validationError('message', 'Message is required'));
      }

      console.log('Processing chat request', { 
        message: message.substring(0, 100),
        filePaths: filePaths.length,
        workspacePath
      });

      // 根据 workspacePath 重新初始化 Gemini 客户端
      await this.initializeGeminiClient(workspacePath);

      if (!this.geminiClient) {
        throw new Error('Gemini client not initialized');
      }

      // 构建完整的消息内容
      let fullMessage = message;
      
      console.log('Original message:', message);
      console.log('File paths is array:', Array.isArray(filePaths));
      
      // 如果有文件路径，将文件路径信息添加到消息中，让 Gemini 模型通过工具调用来读取文件
      if (filePaths && filePaths.length > 0) {
        console.log('File paths length:', filePaths.length);
        
        const filePathsText = filePaths.map((p: string) => `@${p}`).join(' ');
        console.log('Generated filePathsText:', filePathsText);
        
        fullMessage = `${message}\n${filePathsText}`;
        console.log('Updated message with file paths:', fullMessage);
      } else {
        console.log('No file paths to process');
      }

      if (stream) {
        // 使用 gemini-cli 的 Turn 类处理流式响应
        await this.handleStreamingChat(fullMessage, res);
      } else {
        // 完整响应
        try {
          console.log('=== 开始发送消息到 Gemini ===');
          console.log('发送的消息内容:', fullMessage);
          
          const chat = this.geminiClient.getChat();
          
          // 获取工具注册表
          const toolRegistry = await this.config!.getToolRegistry();
          
          // 获取工具声明
          const functionDeclarations = toolRegistry.getFunctionDeclarations();
          console.log('工具声明数量:', functionDeclarations.length);
          
          // 统一的消息发送处理
          console.log('发送消息到 Gemini...');
          
          const response = await chat.sendMessage({ 
            message: fullMessage,
            config: {
              tools: functionDeclarations.length > 0 ? [
                { functionDeclarations },
              ] : undefined,
            },
          });
          
          console.log('=== Gemini 响应完成 ===');
          console.log('响应类型:', typeof response);
          console.log('响应内容:', response);
          
          // 检查是否有工具调用
          const functionCalls = response.functionCalls || [];
          console.log('直接的工具调用:', functionCalls);
          
          // 还需要检查 candidates 中的工具调用
          const candidateFunctionCalls: any[] = [];
          if (response.candidates && response.candidates.length > 0) {
            const content = response.candidates[0].content;
            if (content && content.parts) {
              for (const part of content.parts) {
                if (part.functionCall) {
                  candidateFunctionCalls.push(part.functionCall);
                }
              }
            }
          }
          console.log('从 candidates 中提取的工具调用:', candidateFunctionCalls);
          
          const allFunctionCalls = [...functionCalls, ...candidateFunctionCalls];
          console.log('所有工具调用:', allFunctionCalls);
          console.log('工具调用数量:', allFunctionCalls.length);
          
          if (allFunctionCalls.length > 0) {
            console.log(`发现 ${allFunctionCalls.length} 个工具调用，需要执行工具`);
            console.log('工具调用详情:', allFunctionCalls);
            
            // 执行工具调用
            const toolResults = await this.executeToolCalls(allFunctionCalls);
            
            // 将工具结果发送回 Gemini
            const finalResponse = await chat.sendMessage({
              message: toolResults,
              config: {
                tools: [
                  { functionDeclarations: toolRegistry.getFunctionDeclarations() },
                ],
              },
            });
            
            const finalResponseText = this.getResponseText(finalResponse);
            
            res.json(ResponseFactory.chat(finalResponseText || '工具执行完成，但没有获得文本响应', true));
          } else {
            console.log('没有发现工具调用，直接返回响应');
            // 没有工具调用，直接返回响应
            const responseText = this.getResponseText(response);
            
            res.json(ResponseFactory.chat(responseText || 'No response text available', false));
          }
        } catch (error) {
          res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : 'Unknown error'));
        }
      }
    } catch (error) {
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async handleStreamingChat(message: string, res: express.Response) {
    try {
      console.log('=== 开始流式聊天处理 ===');
      
      // 设置响应头 - 使用JSON格式
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      // 保存当前响应对象
      this.currentResponse = res;

      // 创建新的 Turn 实例
      const chat = this.geminiClient!.getChat();
      this.currentTurn = new Turn(chat);
      
      // 创建工具调度器 - 使用完整的 CoreToolScheduler 功能
      const toolRegistry = await this.config!.getToolRegistry();
      this.toolScheduler = new CoreToolScheduler({
        toolRegistry: Promise.resolve(toolRegistry),
        onAllToolCallsComplete: this.handleAllToolCallsComplete.bind(this),
        onToolCallsUpdate: this.handleToolCallsUpdate.bind(this),
        outputUpdateHandler: this.handleOutputUpdate.bind(this),
        approvalMode: ApprovalMode.DEFAULT,
        getPreferredEditor: () => 'vscode',
        config: this.config!
      });
      
      // 创建中止信号
      this.abortController = new AbortController();
      
      // 初始化消息历史，用于 agentic 循环
      let currentMessageParts: any[] = [{ text: message }];
      
      // Agentic 工具调用主循环
      while (true) {
        console.log('=== 开始新一轮 Gemini 请求 ===');
        
        // 发起 Gemini 流式请求
        const responseStream = await chat.sendMessageStream({
          message: currentMessageParts,
          config: {
            abortSignal: this.abortController.signal,
            tools: [
              { functionDeclarations: toolRegistry.getFunctionDeclarations() },
            ],
          },
        });

        const functionCalls: any[] = [];
        let hasContent = false;

        // 处理流式响应
        for await (const resp of responseStream) {
          if (this.abortController.signal.aborted) {
            console.log('操作被取消');
            this.sendStructuredEvent(res, 'error', { message: '操作被取消' });
            res.end();
            return;
          }

          // 处理文本内容
          const textPart = this.getResponseText(resp);
          if (textPart) {
            this.sendStructuredEvent(res, 'content', { text: textPart, isPartial: true });
            hasContent = true;
          }

          // 收集工具调用请求
          if (resp.functionCalls) {
            functionCalls.push(...resp.functionCalls);
          }
        }

        // 如果有工具调用，执行工具并准备下一轮
        if (functionCalls.length > 0) {
          console.log(`发现 ${functionCalls.length} 个工具调用`);
          
          // 发送工具调用事件
          for (const fc of functionCalls) {
            const callId = fc.id ?? `${fc.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            
            this.sendStructuredEvent(res, 'tool_call', {
              callId,
              name: fc.name,
              displayName: fc.name,
              description: `执行工具: ${fc.name}`,
              args: fc.args || {},
              requiresConfirmation: true
            });
            
            // 发送工具确认事件
            this.sendStructuredEvent(res, 'tool_confirmation', {
              callId,
              name: fc.name,
              displayName: fc.name,
              description: `需要确认工具调用: ${fc.name}`,
              prompt: `是否执行工具调用: ${fc.name}`,
              command: fc.args?.command || null
            });
          }
          
          // 等待所有工具调用完成
          const toolResponseParts: any[] = [];
          
          for (const fc of functionCalls) {
            const callId = fc.id ?? `${fc.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            const requestInfo: ToolCallRequestInfo = {
              callId,
              name: fc.name as string,
              args: (fc.args ?? {}) as Record<string, unknown>,
              isClientInitiated: false,
            };

            console.log('调度工具调用:', requestInfo);
            
            // 发送工具执行状态
            this.sendStructuredEvent(res, 'tool_execution', {
              callId,
              status: 'executing',
              message: `正在执行 ${fc.name}...`
            });
            
            // 使用 CoreToolScheduler 调度工具调用
            await this.toolScheduler!.schedule(requestInfo, this.abortController!.signal);
            
            // 等待工具调用完成（设置超时）
            const completedCall = await this.waitForToolCallCompletionWithTimeout(callId, 30000); // 30秒超时
            
            if (completedCall && completedCall.response) {
              // 发送工具执行结果
              const resultText = this.formatToolResult(completedCall);
              this.sendStructuredEvent(res, 'tool_result', {
                callId,
                name: fc.name,
                result: resultText,
                displayResult: resultText,
                success: true,
                error: null
              });
              
              const parts = Array.isArray(completedCall.response.responseParts)
                ? completedCall.response.responseParts
                : [completedCall.response.responseParts];
              
              for (const part of parts) {
                if (typeof part === 'string') {
                  toolResponseParts.push({ text: part });
                } else if (part) {
                  toolResponseParts.push(part);
                }
              }
            }
          }
          
          // 准备下一轮消息
          currentMessageParts = toolResponseParts;
          
        } else {
          // 没有工具调用，对话结束
          console.log('=== 对话结束，没有更多工具调用 ===');
          this.sendStructuredEvent(res, 'complete', { success: true, message: '对话完成' });
          break;
        }
      }
      
      console.log('=== 流式聊天处理完成 ===');
      res.end();
      
    } catch (error) {
      console.error('Error in handleStreamingChat:', error);
      this.sendStructuredEvent(res, 'error', { 
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'STREAM_ERROR',
        details: error instanceof Error ? error.stack : undefined
      });
      res.end();
    } finally {
      this.currentResponse = null;
    }
  }

  // 处理所有工具调用完成
  private handleAllToolCallsComplete(completedCalls: CompletedToolCall[]) {
    console.log('所有工具调用完成:', completedCalls.length);
    
    if (this.currentResponse) {
      for (const toolCall of completedCalls) {
        console.log('工具调用结果:', toolCall);
        
        // 发送简短的工具执行提示
        const toolName = toolCall.request.name;
        let displayMessage = '';
        
        switch (toolName) {
          case 'read_file':
            displayMessage = '📖 正在读取文件...';
            break;
          case 'list_directory':
            displayMessage = '📁 正在列出目录...';
            break;
          case 'execute_command':
            displayMessage = '⚡ 正在执行命令...';
            break;
          default:
            displayMessage = `🔧 正在执行 ${toolName}...`;
        }
        
        this.currentResponse.write(`\n${displayMessage}\n`);
      }
    }
    
    // 将完成的工具调用响应发送回 Gemini
    this.submitToolResponsesToGemini(completedCalls);
  }

  // 处理工具调用状态更新
  private handleToolCallsUpdate(toolCalls: ToolCall[]) {
    console.log('工具调用状态更新:', toolCalls.length);
    
    // 通知前端状态更新
    this.notifyFrontendToolCallsUpdate(toolCalls);
  }

  // 处理输出更新
  private handleOutputUpdate(callId: string, outputChunk: string) {
    console.log('工具输出更新:', callId, outputChunk);
    
    // 通知前端输出更新
    this.notifyFrontendOutputUpdate(callId, outputChunk);
  }

  // 将工具调用响应发送回 Gemini
  private async submitToolResponsesToGemini(completedCalls: CompletedToolCall[]) {
    try {
      if (!this.currentTurn || !this.abortController) {
        console.log('Turn 或 AbortController 不可用，跳过工具响应提交');
        return;
      }

      console.log('提交工具调用响应到 Gemini:', completedCalls.length);
      
      // 这里需要将工具调用响应发送回 Gemini
      // 由于 Turn 类已经处理了工具调用，我们只需要继续处理流
      // 实际的工具响应处理已经在 Turn 类中完成
      
    } catch (error) {
      console.error('Error submitting tool responses to Gemini:', error);
    }
  }

  // 通知前端工具调用状态更新
  private notifyFrontendToolCallsUpdate(toolCalls: ToolCall[]) {
    // 这里可以实现 WebSocket 或 Server-Sent Events 来通知前端
    // 目前先记录日志
    console.log('通知前端工具调用状态更新:', toolCalls.map(tc => ({
      callId: tc.request.callId,
      name: tc.request.name,
      status: tc.status
    })));
  }

  // 通知前端输出更新
  private notifyFrontendOutputUpdate(callId: string, outputChunk: string) {
    // 这里可以实现 WebSocket 或 Server-Sent Events 来通知前端
    // 目前先记录日志
    console.log('通知前端输出更新:', { callId, outputChunk });
  }

  private getResponseText(response: any): string | null {
    console.log('=== getResponseText 函数开始 ===');
    console.log('输入响应对象:', JSON.stringify(response, null, 2));
    
    if (typeof response === 'string') {
      return response;
    }
    
    if (response && typeof response === 'object') {
      // 处理 Gemini API 响应格式
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          console.log('提取的 parts:', candidate.content.parts);
          console.log('parts 数组长度:', candidate.content.parts.length);
          
          const parts = candidate.content.parts;
          console.log('parts 详情:', parts.map((part: any, index: number) => ({
            index,
            type: typeof part,
            hasText: !!part.text,
            text: part.text,
            hasFunctionCall: !!part.functionCall,
            isThought: part.thought === true
          })));
          
          // 只过滤出 thought !== true 的文本部分
          const textParts = parts
            .filter((part: any) => !part.thought && part.text)
            .map((part: any) => part.text);
          
          console.log('过滤后的用户可见文本段:', textParts);
          
          if (textParts.length > 0) {
            const result = textParts.join('');
            console.log('最终合并的文本:', result);
            console.log('=== getResponseText 函数结束 ===');
            return result;
          } else {
            console.log('没有找到用户可见文本段，返回 undefined');
            console.log('=== getResponseText 函数结束 ===');
            return null;
          }
        }
      }
      
      // 尝试从不同的响应格式中提取文本
      if (response.text) {
        return response.text;
      }
      if (response.response) {
        return response.response;
      }
      if (response.content) {
        return response.content;
      }
      if (response.message) {
        return response.message;
      }
    }
    
    console.log('=== getResponseText 函数结束 ===');
    return null;
  }

  public async handleToolConfirmation(req: express.Request, res: express.Response) {
    try {
      const { callId, outcome } = req.body;
      
      if (!callId || !outcome) {
        return res.status(400).json(ResponseFactory.validationError('callId/outcome', 'callId and outcome are required'));
      }

      console.log('处理工具确认:', { callId, outcome });

      if (!this.toolScheduler) {
        return res.status(500).json(ResponseFactory.internalError('Tool scheduler not initialized'));
      }

      // 获取工具调用 - 直接访问 toolCalls 数组
      const toolCalls = (this.toolScheduler as any).toolCalls;
      const toolCall = toolCalls.find((tc: any) => tc.request.callId === callId);
      
      if (!toolCall || toolCall.status !== 'awaiting_approval') {
        return res.status(404).json(ResponseFactory.notFoundError('Tool call not found or not awaiting approval'));
      }

      // 使用 CoreToolScheduler 的 handleConfirmationResponse
      await this.toolScheduler.handleConfirmationResponse(
        callId,
        toolCall.confirmationDetails.onConfirm,
        outcome,
        this.abortController!.signal
      );
      
      res.json(ResponseFactory.toolConfirmation('Tool confirmation processed'));
      
    } catch (error) {
      res.status(500).json(ResponseFactory.internalError(error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  public getGeminiClient(): GeminiClient | null {
    return this.geminiClient;
  }

  // 等待工具调用完成（带超时）
  private async waitForToolCallCompletionWithTimeout(callId: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkCompletion = () => {
        const toolCalls = (this.toolScheduler as any).toolCalls;
        const toolCall = toolCalls.find((tc: any) => tc.request.callId === callId);
        
        // 检查超时
        if (Date.now() - startTime > timeoutMs) {
          console.log(`工具调用 ${callId} 超时`);
          reject(new Error(`Tool call ${callId} timed out after ${timeoutMs}ms`));
          return;
        }
        
        if (toolCall && (toolCall.status === 'success' || toolCall.status === 'error' || toolCall.status === 'cancelled')) {
          console.log(`工具调用 ${callId} 完成，状态: ${toolCall.status}`);
          resolve(toolCall);
        } else if (toolCall && toolCall.status === 'awaiting_approval') {
          console.log(`工具调用 ${callId} 等待用户确认...`);
          // 继续等待用户确认
          setTimeout(checkCompletion, 500);
        } else {
          console.log(`工具调用 ${callId} 状态: ${toolCall?.status || 'unknown'}`);
          // 继续等待
          setTimeout(checkCompletion, 100);
        }
      };
      
      checkCompletion();
    });
  }

  // 等待工具调用完成（原方法，保留用于兼容性）
  private async waitForToolCallCompletion(callId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        const toolCalls = (this.toolScheduler as any).toolCalls;
        const toolCall = toolCalls.find((tc: any) => tc.request.callId === callId);
        
        if (toolCall && (toolCall.status === 'success' || toolCall.status === 'error' || toolCall.status === 'cancelled')) {
          console.log(`工具调用 ${callId} 完成，状态: ${toolCall.status}`);
          resolve();
        } else if (toolCall && toolCall.status === 'awaiting_approval') {
          console.log(`工具调用 ${callId} 等待用户确认...`);
          // 继续等待用户确认
          setTimeout(checkCompletion, 500);
        } else {
          console.log(`工具调用 ${callId} 状态: ${toolCall?.status || 'unknown'}`);
          // 继续等待
          setTimeout(checkCompletion, 100);
        }
      };
      
      checkCompletion();
    });
  }

  // 发送结构化事件
  private sendStructuredEvent(res: express.Response, type: string, data: any) {
    const event = {
      type,
      data,
      timestamp: new Date().toISOString()
    };
    
    const eventJson = JSON.stringify(event) + '\n';
    res.write(eventJson);
  }
  
  // 格式化工具执行结果
  private formatToolResult(completedCall: any): string {
    if (!completedCall.response) {
      return '工具执行失败';
    }
    
    const toolName = completedCall.request.name;
    let result = '';
    
    // 根据工具名称格式化输出
    switch (toolName) {
      case 'read_file':
        result = '📄 文件内容已读取';
        break;
      case 'list_directory':
        result = '📁 目录列表已获取';
        break;
      case 'write_file':
        result = '✏️ 文件已写入';
        break;
      case 'execute_command':
        result = '⚡ 命令执行完成';
        break;
      default:
        result = `🔧 ${toolName} 执行完成`;
    }
    
    return result;
  }
  
  // 执行工具调用
  private async executeToolCalls(functionCalls: any[]): Promise<string> {
    console.log('开始执行工具调用:', functionCalls.length, '个');
    
    const results: string[] = [];
    
    for (const functionCall of functionCalls) {
      try {
        console.log('执行工具:', functionCall.name, '参数:', functionCall.args);
        
        const toolRegistry = await this.config!.getToolRegistry();
        const tool = toolRegistry.getTool(functionCall.name);
        
        if (!tool) {
          console.error('工具未找到:', functionCall.name);
          results.push(`错误: 工具 ${functionCall.name} 未找到`);
          continue;
        }
        
        // 执行工具
        const result = await tool.execute(functionCall.args, new AbortController().signal);
        
        console.log('工具执行结果:', result);
        
        // 格式化结果
        const formattedResult = this.formatToolResultForGemini(functionCall.name, result);
        results.push(formattedResult);
        
      } catch (error) {
        console.error('工具执行错误:', error);
        results.push(`错误: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
    
    const combinedResults = results.join('\n\n');
    console.log('所有工具执行结果:', combinedResults);
    
    return combinedResults;
  }
  
  // 格式化工具结果供 Gemini 使用
  private formatToolResultForGemini(toolName: string, result: any): string {
    if (!result) {
      return `工具 ${toolName} 执行完成，但没有返回结果`;
    }
    
    // 根据工具类型格式化结果
    switch (toolName) {
      case 'read_file':
        return `文件内容:\n${result.llmContent || result.content || result}`;
      case 'list_directory':
        return `目录内容:\n${result.llmContent || result.content || result}`;
      case 'write_file':
        return `文件写入完成: ${result.success ? '成功' : '失败'}`;
      case 'execute_command':
        return `命令执行结果:\n输出: ${result.output || ''}\n错误: ${result.error || '无'}`;
      default:
        return `工具 ${toolName} 执行结果:\n${JSON.stringify(result, null, 2)}`;
    }
  }
  
  // 通知前端工具调用
  private notifyFrontendToolCalls(functionCalls: any[]) {
    console.log('通知前端工具调用:', functionCalls.map(fc => ({
      name: fc.name,
      args: fc.args
    })));
    
    // 这里可以实现 WebSocket 或 Server-Sent Events 来通知前端
    // 目前先记录日志
  }
} 