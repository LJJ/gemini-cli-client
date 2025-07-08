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

// API 响应模型
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
} 