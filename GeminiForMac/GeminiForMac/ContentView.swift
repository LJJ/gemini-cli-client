//
//  ContentView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import SwiftUI
import Factory

struct ContentView: View {
    @StateObject private var chatService = ChatService()
    @StateObject private var fileExplorerService = FileExplorerService()
    @State private var messageText = ""
    @FocusState private var isTextFieldFocused: Bool
    @StateObject private var authService = Container.shared.authService.resolve()
    
    var body: some View {
        HSplitView {
            // 文件浏览器
            FileExplorerView()
                .environmentObject(fileExplorerService)
                .frame(minWidth: 200, maxWidth: 400)
            
            // 聊天界面
            VStack(spacing: 0) {
                // 聊天消息列表
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(chatService.messages) { message in
                                MessageView(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                    .onChange(of: chatService.messages.count) { _ in
                        if let lastMessage = chatService.messages.last {
                            withAnimation(.easeInOut(duration: 0.3)) {
                                proxy.scrollTo(lastMessage.id, anchor: .bottom)
                            }
                        }
                    }
                }
                
                // 错误消息
                if let errorMessage = chatService.errorMessage {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.red)
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.caption)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.red.opacity(0.1))
                }
                
                // 加载状态
                if chatService.isLoading {
                    HStack {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("正在处理...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
                
                // 输入区域
                VStack(spacing: 8) {
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

        // 认证对话框
        .sheet(isPresented: $authService.showAuthDialog) {
            AuthDialogView()
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
        }
        // 工具确认对话框
        .sheet(isPresented: $chatService.showToolConfirmation) {
            if let confirmation = chatService.pendingToolConfirmation {
                ToolConfirmationView(
                    confirmation: confirmation,
                    onConfirm: { outcome in
                        Task {
                            await chatService.handleToolConfirmation(outcome: outcome)
                        }
                    },
                    onCancel: {
                        chatService.cancelToolConfirmation()
                    }
                )
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
            }
        }
    }
    
    private func sendMessage() {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        
        messageText = ""
        isTextFieldFocused = false
        
        Task {
            // 获取选中的文件路径
            let selectedFilePaths = Array(fileExplorerService.selectedFiles)
            
            // 发送消息（包含文件路径和工作目录）
            await chatService.sendMessage(text, filePaths: selectedFilePaths, workspacePath: fileExplorerService.currentPath)
        }
    }
}

#Preview {
    ContentView()
}
