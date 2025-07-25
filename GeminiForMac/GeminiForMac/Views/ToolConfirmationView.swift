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
    
    // 判断是否需要大窗口进行代码审查
    private var needsLargeWindow: Bool {
        switch confirmation.confirmationDetails.toolName {
        case .replace, .writeFile:
            return true
        default:
            return false
        }
    }
    
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
                VStack(alignment: .leading, spacing: 8) {
                    Text("将要修改文件:")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Text(confirmation.confirmationDetails.fileName)
                        .font(.system(.body, design: .monospaced))
                        .padding(8)
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(6)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                
                // 根据工具类型显示不同的内容
                switch confirmation.confirmationDetails.toolName {
                case .replace:
                    // replace tool: 显示 oldStr 和 newStr 的对比
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("代码变更:")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            Spacer()
                            
                            Text("请仔细审查代码变更")
                                .font(.caption)
                                .foregroundColor(.orange)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Color.orange.opacity(0.1))
                                .cornerRadius(4)
                        }
                        
                        SideBySideDiffView(
                            oldContent: confirmation.confirmationDetails.oldStr ?? "",
                            newContent: confirmation.confirmationDetails.newStr ?? "",
                            filename: confirmation.confirmationDetails.fileName
                        )
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    
                case .writeFile:
                    // write_file tool: 只显示 content
                    if let content = confirmation.confirmationDetails.content, !content.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(String(localized: "将要写入的内容:"))
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                
                                Spacer()
                                
                                Text(String(localized: "请审查文件内容"))
                                    .font(.caption)
                                    .foregroundColor(.green)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.green.opacity(0.1))
                                    .cornerRadius(4)
                            }
                            
                            ScrollView {
                                Text(content)
                                    .font(.system(.caption, design: .monospaced))
                                    .padding(12)
                                    .background(Color.green.opacity(0.05))
                                    .cornerRadius(6)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .frame(height: 400)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(Color.green.opacity(0.3), lineWidth: 1)
                            )
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                case .runShellCommand:
                    // write_file tool: 只显示 content
                    if let content = confirmation.confirmationDetails.content, !content.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(confirmation.confirmationDetails.description ?? String(localized: "执行命令"))
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            ScrollView {
                                Text(confirmation.confirmationDetails.command ?? "")
                                    .font(.system(.body, design: .monospaced))
                                    .padding(12)
                                    .background(Color.green.opacity(0.1))
                                    .cornerRadius(6)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .frame(maxHeight: 300)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    
                default:
                    // 其他工具: 不展示具体内容
                    EmptyView()
                }
                
            case .info:
                if let prompt = confirmation.confirmationDetails.prompt {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(String(localized: "操作描述:"))
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
                    Text(String(localized: "MCP 工具:"))
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    if let serverName = confirmation.confirmationDetails.serverName {
                        Text(String(format: String(localized: "服务器: %@"), serverName))
                            .font(.body)
                    }
                    Text("工具: \(confirmation.confirmationDetails.toolName)")
                        .font(.body)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            
            // 确认按钮
            VStack(spacing: 12) {
                // 根据确认类型显示不同的按钮
                switch confirmation.confirmationDetails.type {
                case .edit:
                    // 编辑类型的按钮
                    VStack(spacing: 8) {
                        HStack(spacing: 12) {
                            Button(String(localized: "允许一次")) {
                                onConfirm(.proceedOnce)
                            }
                            .buttonStyle(.borderedProminent)
                            
                            Button(String(localized: "总是允许")) {
                                onConfirm(.proceedAlways)
                            }
                            .buttonStyle(.bordered)
                        }
                        
                        HStack(spacing: 12) {
                            Button(String(localized: "使用编辑器修改")) {
                                onConfirm(.modifyWithEditor)
                            }
                            .buttonStyle(.bordered)
                            .foregroundColor(.orange)
                            
                            Button(String(localized: "取消")) {
                                onCancel()
                            }
                            .buttonStyle(.bordered)
                            .foregroundColor(.red)
                        }
                    }
                    
                default:
                    // 其他类型的按钮
                    HStack(spacing: 12) {
                        Button(String(localized: "允许一次")) {
                            onConfirm(.proceedOnce)
                        }
                        .buttonStyle(.borderedProminent)
                        
                        Button(String(localized: "总是允许")) {
                            onConfirm(.proceedAlways)
                        }
                        .buttonStyle(.bordered)
                    }
                    
                    Button(String(localized: "取消")) {
                        onCancel()
                    }
                    .buttonStyle(.bordered)
                    .foregroundColor(.red)
                }
            }
        }
        .padding(20)
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
        .shadow(radius: 10)
        .frame(
            minWidth: needsLargeWindow ? 900 : 400,
            maxWidth: .infinity,
            minHeight: needsLargeWindow ? 600 : 200
        )
    }
}

#Preview {
    ToolConfirmationView(
        confirmation: ToolConfirmationEvent(
            type: "tool_confirmation",
            callId: "test-call-id",
            toolName: .edit,
            confirmationDetails: ToolConfirmationDetails(
                type: .exec,
                title: String(localized: "确认执行命令"),
                command: "ls -la",
                rootCommand: "ls",
                fileName: "filename",
                oldStr: "123",
                newStr: "new",
                content: "123",
                prompt: nil,
                urls: nil,
                serverName: nil,
                toolName: .replace,
                toolDisplayName: "替换内容",
                description: ""
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
