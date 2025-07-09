//
//  StreamEvent.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/9.
//

import Foundation

// MARK: - 结构化事件
struct StreamEvent: Codable {
    let type: String
    let data: EventData
    let timestamp: String
    
    enum EventData: Codable {
        case content(String)
        case toolCall(ToolCallData)
        case toolExecution(ToolExecutionData)
        case toolResult(ToolResultData)
        case toolConfirmation(ToolConfirmationData)
        case error(String)
        case complete(Bool)
        
        private enum CodingKeys: String, CodingKey {
            case type, content, toolCall, toolExecution, toolResult, toolConfirmation, error, complete
        }
        
        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            
            if let content = try? container.decode(String.self, forKey: .content) {
                self = .content(content)
            } else if let toolCall = try? container.decode(ToolCallData.self, forKey: .toolCall) {
                self = .toolCall(toolCall)
            } else if let toolExecution = try? container.decode(ToolExecutionData.self, forKey: .toolExecution) {
                self = .toolExecution(toolExecution)
            } else if let toolResult = try? container.decode(ToolResultData.self, forKey: .toolResult) {
                self = .toolResult(toolResult)
            } else if let toolConfirmation = try? container.decode(ToolConfirmationData.self, forKey: .toolConfirmation) {
                self = .toolConfirmation(toolConfirmation)
            } else if let error = try? container.decode(String.self, forKey: .error) {
                self = .error(error)
            } else if let complete = try? container.decode(Bool.self, forKey: .complete) {
                self = .complete(complete)
            } else {
                self = .error("Invalid event data")
            }
        }
        
        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            
            switch self {
            case .content(let content):
                try container.encode("content", forKey: .type)
                try container.encode(content, forKey: .content)
            case .toolCall(let data):
                try container.encode("tool_call", forKey: .type)
                try container.encode(data, forKey: .toolCall)
            case .toolExecution(let data):
                try container.encode("tool_execution", forKey: .type)
                try container.encode(data, forKey: .toolExecution)
            case .toolResult(let data):
                try container.encode("tool_result", forKey: .type)
                try container.encode(data, forKey: .toolResult)
            case .toolConfirmation(let data):
                try container.encode("tool_confirmation", forKey: .type)
                try container.encode(data, forKey: .toolConfirmation)
            case .error(let error):
                try container.encode("error", forKey: .type)
                try container.encode(error, forKey: .error)
            case .complete(let success):
                try container.encode("complete", forKey: .type)
                try container.encode(success, forKey: .complete)
            }
        }
    }
}

// MARK: - 工具调用数据
struct ToolCallData: Codable {
    let callId: String
    let name: String
    let displayName: String
    let description: String
    let args: [String: String]
    let requiresConfirmation: Bool
}

// MARK: - 工具执行数据
struct ToolExecutionData: Codable {
    let callId: String
    let status: String // "pending", "executing", "completed", "failed"
    let message: String
}

// MARK: - 工具结果数据
struct ToolResultData: Codable {
    let callId: String
    let name: String
    let result: String
    let displayResult: String
    let success: Bool
    let error: String?
}

// MARK: - 工具确认数据
struct ToolConfirmationData: Codable {
    let callId: String
    let name: String
    let displayName: String
    let description: String
    let prompt: String
    let command: String?
} 