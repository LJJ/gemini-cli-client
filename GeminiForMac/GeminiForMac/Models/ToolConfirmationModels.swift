//
//  ToolConfirmationModels.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation

// MARK: - 工具名称枚举
enum ToolName: String, Codable, CaseIterable {
    case writeFile = "write_file"
    case readFile = "read_file"
    case listDirectory = "list_directory"
    case executeCommand = "execute_command"
    case replace = "replace"
    case edit = "edit"
    case webFetch = "web_fetch"
    case webSearch = "web_search"
    case saveMemory = "save_memory"
    case loadMemory = "load_memory"
    case deleteMemory = "delete_memory"
    case listMemory = "list_memory"
    
    // 显示名称
    var displayName: String {
        switch self {
        case .writeFile:
            return "写入文件"
        case .readFile:
            return "读取文件"
        case .listDirectory:
            return "列出目录"
        case .executeCommand:
            return "执行命令"
        case .replace:
            return "替换内容"
        case .edit:
            return "编辑文件"
        case .webFetch:
            return "获取网页"
        case .webSearch:
            return "搜索网页"
        case .saveMemory:
            return "保存记忆"
        case .loadMemory:
            return "加载记忆"
        case .deleteMemory:
            return "删除记忆"
        case .listMemory:
            return "列出记忆"
        }
    }
}

// MARK: - 工具确认模型

// 工具确认类型
enum ToolConfirmationType: String, Codable {
    case exec = "exec"
    case edit = "edit"
    case info = "info"
    case mcp = "mcp"
}

// 工具确认结果 - 与gemini-cli保持一致
enum ToolConfirmationOutcome: String, Codable {
    case proceedOnce = "proceed_once"
    case proceedAlways = "proceed_always"
    case proceedAlwaysServer = "proceed_always_server"
    case proceedAlwaysTool = "proceed_always_tool"
    case modifyWithEditor = "modify_with_editor"
    case cancel = "cancel"
}

// 工具确认详情
struct ToolConfirmationDetails: Codable {
    let type: ToolConfirmationType
    let title: String
    let command: String?
    let rootCommand: String?
    let fileName: String
    let oldStr: String?
    let newStr: String?
    let content: String?
    let prompt: String?
    let urls: [String]?
    let serverName: String?
    let toolName: ToolName
    let toolDisplayName: String?
}

// 工具确认请求
struct ToolConfirmationRequest: Codable {
    let callId: String
    let outcome: ToolConfirmationOutcome
}

// 工具确认响应 - 更新为标准化格式
struct ToolConfirmationResponse: Codable {
    let success: Bool
    let message: String
    let timestamp: String
    let error: String?
}

// 工具确认事件
struct ToolConfirmationEvent: Codable {
    let type: String
    let callId: String
    let toolName: ToolName
    let confirmationDetails: ToolConfirmationDetails
} 
