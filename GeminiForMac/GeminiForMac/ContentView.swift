//
//  ContentView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import SwiftUI

struct ContentView: View {
    @StateObject private var chatService = ChatService()
    @State private var messageText = ""
    @FocusState private var isTextFieldFocused: Bool
    @State private var showFileExplorer = true
    
    var body: some View {
        HStack(spacing: 0) {
            // 文件浏览器侧边栏
            if showFileExplorer {
                FileExplorerView()
                    .transition(.move(edge: .leading))
            }
            
            // 主聊天区域
            VStack(spacing: 0) {
                // 顶部状态栏
                HStack {
                    // 文件浏览器切换按钮
                    Button(action: {
                        withAnimation(.easeInOut(duration: 0.3)) {
                            showFileExplorer.toggle()
                        }
                    }) {
                        Image(systemName: showFileExplorer ? "sidebar.left" : "sidebar.left.slash")
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                    
                    // 连接状态指示器
                    HStack(spacing: 6) {
                        Circle()
                            .fill(chatService.isConnected ? Color.green : Color.red)
                            .frame(width: 8, height: 8)
                        Text(chatService.isConnected ? "已连接" : "未连接")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    // 标题
                    Text("Gemini CLI")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Spacer()
                    
                    // 清除按钮
                    Button(action: {
                        chatService.clearMessages()
                    }) {
                        Image(systemName: "trash")
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color(NSColor.controlBackgroundColor))
                
                Divider()
                
                // 聊天区域
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(chatService.messages) { message in
                                MessageView(message: message)
                                    .id(message.id)
                            }
                            
                            // 加载指示器
                            if chatService.isLoading {
                                HStack {
                                    ProgressView()
                                        .scaleEffect(0.8)
                                    Text("正在思考...")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                .padding()
                            }
                        }
                    }
                    .onChange(of: chatService.messages.count) { _ in
                        if let lastMessage = chatService.messages.last {
                            withAnimation(.easeOut(duration: 0.3)) {
                                proxy.scrollTo(lastMessage.id, anchor: .bottom)
                            }
                        }
                    }
                }
                
                Divider()
                
                // 错误消息
                if let errorMessage = chatService.errorMessage {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                        Button("重试") {
                            Task {
                                await chatService.checkConnection()
                            }
                        }
                        .buttonStyle(.plain)
                        .font(.caption)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.orange.opacity(0.1))
                }
                
                // 输入区域
                HStack(spacing: 12) {
                    TextField("输入消息...", text: $messageText, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .focused($isTextFieldFocused)
                        .lineLimit(1...5)
                        .onSubmit {
                            sendMessage()
                        }
                    
                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundColor(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .secondary : .blue)
                    }
                    .disabled(messageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || chatService.isLoading)
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color(NSColor.controlBackgroundColor))
            }
        }
        .frame(minWidth: 650, minHeight: 500)
        .onAppear {
            Task {
                await chatService.checkConnection()
            }
        }
    }
    
    private func sendMessage() {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        
        messageText = ""
        isTextFieldFocused = false
        
        Task {
            await chatService.sendMessage(text)
        }
    }
}

#Preview {
    ContentView()
}
