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
    
    private let apiService = APIService()
    
    init() {
        // 添加欢迎消息
        messages.append(ChatMessage(
            content: "你好！我是 Gemini CLI 助手。我可以帮助你编写代码、回答问题或执行各种任务。",
            isUser: false
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
    
    // 发送消息
    func sendMessage(_ text: String) async {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        // 添加用户消息
        let userMessage = ChatMessage(content: text, isUser: true)
        messages.append(userMessage)
        
        isLoading = true
        errorMessage = nil
        
        do {
            // 尝试流式响应
          let stream = await apiService.sendMessageStream(text)
            var responseContent = ""
            
            for try await chunk in stream {
                responseContent += chunk
                
                // 更新最后一条消息或创建新消息
                if let lastMessage = messages.last, !lastMessage.isUser {
                    // 更新现有响应消息
                    messages[messages.count - 1] = ChatMessage(
                        content: responseContent,
                        isUser: false,
                        timestamp: lastMessage.timestamp
                    )
                } else {
                    // 创建新的响应消息
                    messages.append(ChatMessage(
                        content: responseContent,
                        isUser: false
                    ))
                }
            }
            
            // 如果流式响应失败，尝试普通响应
            if responseContent.isEmpty {
                if let response = await apiService.sendMessage(text) {
                    messages.append(ChatMessage(
                        content: response.response,
                        isUser: false
                    ))
                } else {
                    errorMessage = "发送消息失败，请检查网络连接。"
                }
            }
        } catch {
            errorMessage = "发送消息时发生错误: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    // 清除消息
    func clearMessages() {
        messages.removeAll()
        // 重新添加欢迎消息
        messages.append(ChatMessage(
            content: "你好！我是 Gemini CLI 助手。我可以帮助你编写代码、回答问题或执行各种任务。",
            isUser: false
        ))
    }
} 
