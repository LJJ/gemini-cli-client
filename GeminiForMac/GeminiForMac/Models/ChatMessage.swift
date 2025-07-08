//
//  ChatMessage.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation

struct ChatMessage: Identifiable, Codable {
    let id = UUID()
    let content: String
    let isUser: Bool
    let timestamp: Date
    
    init(content: String, isUser: Bool, timestamp: Date = Date()) {
        self.content = content
        self.isUser = isUser
        self.timestamp = timestamp
    }
}

// MARK: - API 响应模型

// 聊天相关
struct ChatResponse: Codable {
    let response: String
    let timestamp: String
}

struct StatusResponse: Codable {
    let status: String
    let timestamp: String
    let version: String
}

struct ChatRequest: Codable {
    let message: String
    let stream: Bool?
    let filePaths: [String]?
    let workspacePath: String?
}

// MARK: - 文件操作相关

// 目录项
struct DirectoryItem: Codable, Identifiable {
    let id = UUID()
    let name: String
    let type: String // "directory" 或 "file"
    let path: String
    
    enum CodingKeys: String, CodingKey {
        case name, type, path
    }
}

// 目录响应
struct DirectoryResponse: Codable {
    let path: String
    let items: [DirectoryItem]
    let timestamp: String
}

// 文件响应
struct FileResponse: Codable {
    let path: String
    let content: String?
    let success: Bool?
    let message: String?
    let timestamp: String
}

// 文件请求
struct FileRequest: Codable {
    let path: String
}

// 文件写入请求
struct FileWriteRequest: Codable {
    let path: String
    let content: String
}

// MARK: - 命令执行相关

// 命令请求
struct CommandRequest: Codable {
    let command: String
    let cwd: String?
}

// 命令响应
struct CommandResponse: Codable {
    let command: String
    let output: String
    let error: String?
    let exitCode: Int
    let timestamp: String
} 