//
//  ChatModels.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation

// MARK: - 聊天消息模型
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

// MARK: - 聊天API模型
struct ChatResponse: Codable {
    let response: String
    let timestamp: String
}

struct ChatRequest: Codable {
    let message: String
    let stream: Bool?
    let filePaths: [String]?
    let workspacePath: String?
}

struct StatusResponse: Codable {
    let status: String
    let timestamp: String
    let version: String
} 