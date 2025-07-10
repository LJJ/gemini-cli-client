//
//  ChatModels.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation

enum ChatMessageType:Int, Codable{
	case user
	case text
	case image
	case thinking
}

// MARK: - 聊天消息模型
struct ChatMessage: Identifiable, Codable {
    let id = UUID()
    let content: String
    let type: ChatMessageType
    let timestamp: Date
    
	init(content: String, type:ChatMessageType, timestamp: Date = Date()) {
        self.content = content
        self.type = type
        self.timestamp = timestamp
    }
	
	var isUser:Bool{
		type == .user
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
