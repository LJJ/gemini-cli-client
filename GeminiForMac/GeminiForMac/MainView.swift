//
//  ContentView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import SwiftUI
import Factory

struct MainView: View {
    @ObservedObject private var chatService = Container.shared.chatService.resolve()
    @ObservedObject private var fileExplorerService = Container.shared.fileExplorerService.resolve()
    @StateObject private var authService = Container.shared.authService.resolve()
    
    var body: some View {
        HSplitView {
            // 文件浏览器
            FileExplorerView()
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

                // 状态消息
                if let statusMessage = chatService.statusMessage {
                    HStack {
                        if chatService.isLoading { // 如果正在加载，显示 ProgressView
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                        Text(statusMessage)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.blue.opacity(0.1)) // 可以根据需要调整颜色
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
                
                // 输入区域
                MessageInputView()
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
}

#Preview {
    MainView()
}
