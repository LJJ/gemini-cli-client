//
//  ToolConfirmationModels.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation

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
    let fileName: String?
    let fileDiff: String?
    let prompt: String?
    let urls: [String]?
    let serverName: String?
    let toolName: String?
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
    let toolName: String
    let confirmationDetails: ToolConfirmationDetails
} 