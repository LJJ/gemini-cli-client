//
//  ToolConfirmationView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import SwiftUI

struct ToolConfirmationView: View {
    let confirmation: ToolConfirmationEvent
    let onConfirm: (ToolConfirmationOutcome) -> Void
    let onCancel: () -> Void
    
    var body: some View {
        VStack(spacing: 16) {
            // 标题
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.orange)
                Text("需要确认操作")
                    .font(.headline)
                    .fontWeight(.semibold)
                Spacer()
            }
            
            // 工具信息
            VStack(alignment: .leading, spacing: 8) {
                Text("工具: \(confirmation.toolName)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Text(confirmation.confirmationDetails.title)
                    .font(.body)
                    .fontWeight(.medium)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            
            // 根据确认类型显示不同内容
            switch confirmation.confirmationDetails.type {
            case .exec:
                if let command = confirmation.confirmationDetails.command {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("将要执行的命令:")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Text(command)
                            .font(.system(.body, design: .monospaced))
                            .padding(8)
                            .background(Color.gray.opacity(0.1))
                            .cornerRadius(6)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                
            case .edit:
                if let fileName = confirmation.confirmationDetails.fileName {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("将要修改文件:")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Text(fileName)
                            .font(.system(.body, design: .monospaced))
                            .padding(8)
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(6)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                
            case .info:
                if let prompt = confirmation.confirmationDetails.prompt {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("操作描述:")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Text(prompt)
                            .font(.body)
                            .padding(8)
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(6)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                
            case .mcp:
                VStack(alignment: .leading, spacing: 8) {
                    Text("MCP 工具:")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    if let serverName = confirmation.confirmationDetails.serverName {
                        Text("服务器: \(serverName)")
                            .font(.body)
                    }
                    
                    if let toolName = confirmation.confirmationDetails.toolName {
                        Text("工具: \(toolName)")
                            .font(.body)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // 确认按钮
            VStack(spacing: 12) {
                // 主要操作按钮
                HStack(spacing: 12) {
                    Button("允许一次") {
                        onConfirm(.proceedOnce)
                    }
                    .buttonStyle(.borderedProminent)
                    
                    Button("总是允许") {
                        onConfirm(.proceedAlways)
                    }
                    .buttonStyle(.bordered)
                }
                
                // 取消按钮
                Button("取消") {
                    onCancel()
                }
                .buttonStyle(.bordered)
                .foregroundColor(.red)
            }
        }
        .padding(20)
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
        .shadow(radius: 10)
        .frame(maxWidth: 500)
    }
}

#Preview {
    ToolConfirmationView(
        confirmation: ToolConfirmationEvent(
            type: "tool_confirmation",
            callId: "test-call-id",
            toolName: "run_shell_command",
            confirmationDetails: ToolConfirmationDetails(
                type: .exec,
                title: "确认执行命令",
                command: "ls -la",
                rootCommand: "ls",
                fileName: nil,
                fileDiff: nil,
                prompt: nil,
                urls: nil,
                serverName: nil,
                toolName: nil,
                toolDisplayName: nil
            )
        ),
        onConfirm: { outcome in
            print("确认操作: \(outcome)")
        },
        onCancel: {
            print("取消操作")
        }
    )
    .padding()
} 