//
//  StreamEvent.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/9.
//

import Foundation

// MARK: - 标准化流式事件定义
// 与后端 API 规范完全一致

// 基础事件结构
struct StreamEvent: Codable {
    let type: EventType
    let data: EventData
    let timestamp: String
    
    // 自定义解码逻辑，根据 type 字段直接解析 data
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        // 解析 type 和 timestamp
        let typeString = try container.decode(String.self, forKey: .type)
        guard let eventType = EventType(rawValue: typeString) else {
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Invalid event type: \(typeString)"
            )
        }
        self.type = eventType
        self.timestamp = try container.decode(String.self, forKey: .timestamp)
        
        // 根据 type 直接解析对应的 data 结构
        switch eventType {
        case .content:
            let contentData = try container.decode(ContentEventData.self, forKey: .data)
            self.data = .content(contentData)
        case .thought:
            let thoughtData = try container.decode(ThoughtEventData.self, forKey: .data)
            self.data = .thought(thoughtData)
        case .toolCall:
            let toolCallData = try container.decode(ToolCallEventData.self, forKey: .data)
            self.data = .toolCall(toolCallData)
        case .toolExecution:
            let toolExecutionData = try container.decode(ToolExecutionEventData.self, forKey: .data)
            self.data = .toolExecution(toolExecutionData)
        case .toolResult:
            let toolResultData = try container.decode(ToolResultEventData.self, forKey: .data)
            self.data = .toolResult(toolResultData)
        case .toolConfirmation:
            let toolConfirmationData = try container.decode(ToolConfirmationEventData.self, forKey: .data)
            self.data = .toolConfirmation(toolConfirmationData)
        case .complete:
            let completeData = try container.decode(CompleteEventData.self, forKey: .data)
            self.data = .complete(completeData)
        case .error:
            let errorData = try container.decode(ErrorEventData.self, forKey: .data)
            self.data = .error(errorData)
        }
    }
    
    // 自定义编码逻辑
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(type.rawValue, forKey: .type)
        try container.encode(timestamp, forKey: .timestamp)
        
        // 根据 data 类型编码对应的结构
        switch data {
        case .content(let contentData):
            try container.encode(contentData, forKey: .data)
        case .thought(let thoughtData):
            try container.encode(thoughtData, forKey: .data)
        case .toolCall(let toolCallData):
            try container.encode(toolCallData, forKey: .data)
        case .toolExecution(let toolExecutionData):
            try container.encode(toolExecutionData, forKey: .data)
        case .toolResult(let toolResultData):
            try container.encode(toolResultData, forKey: .data)
        case .toolConfirmation(let toolConfirmationData):
            try container.encode(toolConfirmationData, forKey: .data)
        case .complete(let completeData):
            try container.encode(completeData, forKey: .data)
        case .error(let errorData):
            try container.encode(errorData, forKey: .data)
        }
    }
    
    private enum CodingKeys: String, CodingKey {
        case type, data, timestamp
    }
}

// 事件类型枚举
enum EventType: String, Codable {
    case content = "content"
    case thought = "thought"
    case toolCall = "tool_call"
    case toolExecution = "tool_execution"
    case toolResult = "tool_result"
    case toolConfirmation = "tool_confirmation"
    case complete = "complete"
    case error = "error"
}

// 事件数据联合类型
enum EventData {
    case content(ContentEventData)
    case thought(ThoughtEventData)
    case toolCall(ToolCallEventData)
    case toolExecution(ToolExecutionEventData)
    case toolResult(ToolResultEventData)
    case toolConfirmation(ToolConfirmationEventData)
    case complete(CompleteEventData)
    case error(ErrorEventData)
}

// MARK: - 具体事件数据结构

// 1. 内容事件数据
struct ContentEventData: Codable {
    let text: String
    let isPartial: Bool
}

// 2. 思考事件数据
struct ThoughtEventData: Codable {
    let subject: String
    let description: String
}

// 3. 工具调用事件数据
struct ToolCallEventData: Codable {
    let callId: String
    let name: ToolName
    let displayName: String
    let description: String
    let args: [String: String]
    let requiresConfirmation: Bool
}

// 4. 工具执行事件数据
struct ToolExecutionEventData: Codable {
    let callId: String
    let status: ToolExecutionStatus
    let message: String
}

enum ToolExecutionStatus: String, Codable {
    case pending = "pending"
    case executing = "executing"
    case completed = "completed"
    case failed = "failed"
}

// 5. 工具结果事件数据
struct ToolResultEventData: Codable {
    let callId: String
    let name: ToolName
    let result: String
    let displayResult: String
    let success: Bool
    let error: String?
}

// 6. 工具确认事件数据
struct ToolConfirmationEventData: Codable {
    let callId: String
    let name: ToolName
    let displayName: String
    let description: String
    let prompt: String
    let command: String?
    let args: CommandArgs
}

struct CommandArgs:Codable {
    let oldString:String?
    let newString:String?
    let filePath:String
    let content:String?
}

// 7. 完成事件数据
struct CompleteEventData: Codable {
    let success: Bool
    let message: String?
}

// 8. 错误事件数据
struct ErrorEventData: Codable {
    let message: String
    let code: String?
    let details: String?
}

// MARK: - 事件解析工具

extension StreamEvent {
    // 从 JSON 字符串解析事件
    static func parse(from jsonString: String) -> StreamEvent? {
        guard let data = jsonString.data(using: .utf8) else { return nil }
        
        do {
            let jsonDecoder = JSONDecoder()
            jsonDecoder.keyDecodingStrategy = .convertFromSnakeCase
            let event = try jsonDecoder.decode(StreamEvent.self, from: data)
            return event
        } catch {
            print("解析流式事件失败: \(error)")
            return nil
        }
    }
    
    // 验证事件是否有效
    var isValid: Bool {
        return !timestamp.isEmpty && type.rawValue.count > 0
    }
}

// MARK: - 事件类型检查扩展

extension StreamEvent {
    var isContent: Bool { type == .content }
    var isThought: Bool { type == .thought }
    var isToolCall: Bool { type == .toolCall }
    var isToolExecution: Bool { type == .toolExecution }
    var isToolResult: Bool { type == .toolResult }
    var isToolConfirmation: Bool { type == .toolConfirmation }
    var isComplete: Bool { type == .complete }
    var isError: Bool { type == .error }
} 
