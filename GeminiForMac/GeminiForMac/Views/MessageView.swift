//
//  MessageView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import SwiftUI
import MarkdownUI

struct MessageView: View {
    let message: ChatMessage
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // 头像
            Circle()
                .fill(message.isUser ? Color.blue : Color.green)
                .frame(width: 32, height: 32)
                .overlay(
                    Image(systemName: message.isUser ? "person.fill" : "brain.head.profile")
                        .foregroundColor(.white)
                        .font(.system(size: 14))
                )
            
            // 消息内容
            VStack(alignment: .leading, spacing: 4) {
                // 发送者名称
                Text(message.isUser ? "你" : "Gemini")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                // 消息文本
                if message.isUser {
                    // 用户消息使用普通文本
                    Text(message.content)
                        .font(.body)
                        .foregroundColor(.primary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.blue.opacity(0.1))
                        )
                        .textSelection(.enabled)
                } else {
                    // Gemini 回复使用 Markdown 渲染
                    MarkdownTextView(text: message.content)
                        .markdownTheme(.basic)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.green.opacity(0.1))
                        )
                        .background(Color.clear) // 添加此行，尝试设置背景为透明
                }
                
                // 时间戳
                Text(message.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

#Preview {
    VStack {
        MessageView(message: ChatMessage(
            content: "你好！我是 Gemini CLI 助手。",
			type: .image
        ))
        
        MessageView(message: ChatMessage(
            content: "请帮我写一个 Swift 函数",
			type: .user
        ))
    }
    .padding()
} 
