//
//  ChatService.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation
import SwiftUI

@MainActor
class ChatService: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isConnected = false
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var pendingToolConfirmation: ToolConfirmationEvent?
    @Published var showToolConfirmation = false
    
    private let apiService = APIService()
    
    init() {
        // 添加欢迎消息
        messages.append(ChatMessage(
            content: "你好！我是 Gemini CLI 助手。我可以帮助你编写代码、回答问题或执行各种任务。\n\n💡 提示：你可以在文件浏览器中选择文件，然后发送消息时我会自动包含文件内容进行分析。",
			type: .thinking
        ))
    }
    
    // 检查连接状态
    func checkConnection() async {
        isConnected = await apiService.checkServerStatus()
        if !isConnected {
            errorMessage = "无法连接到 Gemini CLI 服务器。请确保服务器正在运行。"
        } else {
            errorMessage = nil
        }
    }
    
    // 发送消息（带文件路径和工作目录）
    func sendMessage(_ text: String, filePaths: [String] = [], workspacePath: String? = nil) async {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        // 添加用户消息
		let userMessage = ChatMessage(content: text, type: .user)
        messages.append(userMessage)
        
        // 如果有文件路径，添加一个系统消息显示文件信息
        if !filePaths.isEmpty {
            let fileInfoMessage = ChatMessage(
                content: "📎 已选择 \(filePaths.count) 个文件进行分析",
				type: .thinking
            )
            messages.append(fileInfoMessage)
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            // 统一使用流式响应，让 AI 自动决定是否需要交互式处理
            let stream = await apiService.sendMessageStream(text, filePaths: filePaths, workspacePath: workspacePath)
            
            for try await chunk in stream {
                // 解析结构化事件
                if let event = parseStructuredEvent(chunk) {
                    handleStructuredEvent(event)
                } else {
                    // 如果不是结构化事件，记录错误
                    print("收到非结构化响应: \(chunk)")
                }
            }
        } catch {
            errorMessage = "发送消息时发生错误: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    // 解析结构化事件
    private func parseStructuredEvent(_ chunk: String) -> StreamEvent? {
        return StreamEvent.parse(from: chunk)
    }
    
    // 处理结构化事件
    private func handleStructuredEvent(_ event: StreamEvent) {
        switch event.data {
        case .content(let data):
            // 处理文本内容
			if let lastIndex = messages.indices.last, messages.last?.type == .text {
                messages[lastIndex] = ChatMessage(
                    content: messages[lastIndex].content + data.text,
					type: .text,
                    timestamp: messages[lastIndex].timestamp
                )
            } else {
                messages.append(ChatMessage(content: data.text, type: .text))
            }
            
        case .thought(let data):
            // 处理思考过程 - 可以选择显示或隐藏
            // 这里我们选择显示思考过程，让用户了解 AI 的推理过程
            let thoughtMessage = ChatMessage(
                content: "💭 **\(data.subject)**\n\(data.description)",
				type: .thinking
            )
//            messages.append(thoughtMessage)
            
        case .toolCall(let data):
            // 处理工具调用
            let toolMessage = ChatMessage(
                content: "🔧 正在调用工具: \(data.displayName)",
				type: .thinking
            )
            messages.append(toolMessage)
            
        case .toolExecution(let data):
            // 处理工具执行状态
            let statusMessage = ChatMessage(
                content: "⚡ \(data.message)",
				type: .thinking
            )
            messages.append(statusMessage)
            
        case .toolResult(let data):
            // 处理工具执行结果
            let resultMessage = ChatMessage(
                content: data.displayResult,
				type: .thinking
            )
            messages.append(resultMessage)
            
        case .toolConfirmation(let data):
            // 处理工具确认请求
            let confirmationEvent = ToolConfirmationEvent(
                type: "tool_confirmation",
                callId: data.callId,
                toolName: data.name,
                confirmationDetails: ToolConfirmationDetails(
                    type: .exec,
                    title: "需要确认工具调用: \(data.displayName)",
                    command: data.command,
                    rootCommand: nil,
                    fileName: nil,
                    fileDiff: nil,
                    prompt: data.prompt,
                    urls: nil,
                    serverName: nil,
                    toolName: data.name,
                    toolDisplayName: data.displayName
                )
            )
            pendingToolConfirmation = confirmationEvent
            showToolConfirmation = true
            
        case .error(let data):
            // 处理错误
            self.errorMessage = data.message
            
        case .complete(let data):
            // 处理完成事件
            print("chat complete")
        }
    }
    

    
    // 处理工具确认
    func handleToolConfirmation(outcome: ToolConfirmationOutcome) async {
        guard let confirmation = pendingToolConfirmation else { return }
        
        // 添加确认消息
        let confirmationMessage = ChatMessage(
            content: "✅ 已确认工具调用: \(confirmation.toolName)",
			type: .thinking
        )
        messages.append(confirmationMessage)
        
        // 发送确认到服务器
        if let response = await apiService.sendToolConfirmation(
            callId: confirmation.callId,
            outcome: outcome
        ) {
            if response.success {
                // 添加成功消息
                let successMessage = ChatMessage(
                    content: "🔄 正在执行工具调用...",
					type: .thinking
                )
                messages.append(successMessage)
                
                // 等待一段时间，让服务器处理工具调用
                try? await Task.sleep(nanoseconds: 1_000_000_000) // 1秒
                
                // 更新消息状态
                if let lastIndex = messages.indices.last {
                    messages[lastIndex] = ChatMessage(
                        content: "✅ 工具调用执行完成",
						type: .thinking,
                        timestamp: messages[lastIndex].timestamp
                    )
                }
            } else {
                errorMessage = "确认操作失败: \(response.message)"
            }
        } else {
            errorMessage = "发送确认失败，请检查网络连接。"
        }
        
        // 清除确认状态
        pendingToolConfirmation = nil
        showToolConfirmation = false
    }
    
    // 取消工具确认
    func cancelToolConfirmation() {
        pendingToolConfirmation = nil
        showToolConfirmation = false
    }
    
    // 发送消息（重载，兼容原有调用）
    func sendMessage(_ text: String) async {
        await sendMessage(text, filePaths: [], workspacePath: nil)
    }
    
    // 清除消息
    func clearMessages() {
        messages.removeAll()
        // 重新添加欢迎消息
        messages.append(ChatMessage(
            content: "你好！我是 Gemini CLI 助手。我可以帮助你编写代码、回答问题或执行各种任务。\n\n💡 提示：你可以在文件浏览器中选择文件，然后发送消息时我会自动包含文件内容进行分析。",
			type: .thinking
        ))
    }
} 
