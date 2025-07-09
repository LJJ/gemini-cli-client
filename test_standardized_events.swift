import Foundation

// 测试标准化流式事件格式
// 这个文件用于验证我们的标准化格式是否能正确解析各种事件

// 测试数据
let testContentEvent = """
{"type":"content","data":{"text":"正在处理您的请求...","isPartial":true},"timestamp":"2025-07-09T10:27:52.699Z"}
"""

let testThoughtEvent = """
{"type":"thought","data":{"subject":"Considering a Response","description":"I've considered the user's request – a Chinese joke is needed. Currently formulating a suitable punchline. The process is rather direct, but ensuring the joke translates well is a priority. Text output seems the most efficient method."},"timestamp":"2025-07-09T10:23:42.369Z"}
"""

let testToolCallEvent = """
{"type":"tool_call","data":{"callId":"read-123","name":"read_file","displayName":"Read File","description":"读取指定文件的内容","args":{"path":"/path/to/file.txt"},"requiresConfirmation":true},"timestamp":"2025-07-09T10:30:02.000Z"}
"""

let testToolExecutionEvent = """
{"type":"tool_execution","data":{"callId":"read-123","status":"executing","message":"正在执行 read_file..."},"timestamp":"2025-07-09T10:30:03.000Z"}
"""

let testToolResultEvent = """
{"type":"tool_result","data":{"callId":"read-123","name":"read_file","result":"文件的实际内容","displayResult":"📄 文件内容已读取","success":true,"error":null},"timestamp":"2025-07-09T10:30:04.000Z"}
"""

let testToolConfirmationEvent = """
{"type":"tool_confirmation","data":{"callId":"read-123","name":"read_file","displayName":"Read File","description":"需要确认工具调用: read_file","prompt":"是否执行工具调用: read_file","command":"read_file /path/to/file.txt"},"timestamp":"2025-07-09T10:30:02.000Z"}
"""

let testCompleteEvent = """
{"type":"complete","data":{"success":true,"message":"对话完成"},"timestamp":"2025-07-09T10:30:06.000Z"}
"""

let testErrorEvent = """
{"type":"error","data":{"message":"发生错误","code":"ERROR_CODE","details":"详细错误信息"},"timestamp":"2025-07-09T10:30:03.000Z"}
"""

// 简化的测试结构（不依赖完整的 StreamEvent 模型）
struct TestStreamEvent: Codable {
    let type: String
    let data: [String: Any]
    let timestamp: String
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(String.self, forKey: .type)
        timestamp = try container.decode(String.self, forKey: .timestamp)
        
        // 解析 data 为字典
        if let dataContainer = try? container.nestedContainer(keyedBy: DataCodingKeys.self, forKey: .data) {
            var dataDict: [String: Any] = [:]
            
            // 尝试解析所有可能的字段
            if let text = try? dataContainer.decode(String.self, forKey: .text) {
                dataDict["text"] = text
            }
            if let isPartial = try? dataContainer.decode(Bool.self, forKey: .isPartial) {
                dataDict["isPartial"] = isPartial
            }
            if let subject = try? dataContainer.decode(String.self, forKey: .subject) {
                dataDict["subject"] = subject
            }
            if let description = try? dataContainer.decode(String.self, forKey: .description) {
                dataDict["description"] = description
            }
            if let callId = try? dataContainer.decode(String.self, forKey: .callId) {
                dataDict["callId"] = callId
            }
            if let name = try? dataContainer.decode(String.self, forKey: .name) {
                dataDict["name"] = name
            }
            if let displayName = try? dataContainer.decode(String.self, forKey: .displayName) {
                dataDict["displayName"] = displayName
            }
            if let status = try? dataContainer.decode(String.self, forKey: .status) {
                dataDict["status"] = status
            }
            if let message = try? dataContainer.decode(String.self, forKey: .message) {
                dataDict["message"] = message
            }
            if let result = try? dataContainer.decode(String.self, forKey: .result) {
                dataDict["result"] = result
            }
            if let displayResult = try? dataContainer.decode(String.self, forKey: .displayResult) {
                dataDict["displayResult"] = displayResult
            }
            if let success = try? dataContainer.decode(Bool.self, forKey: .success) {
                dataDict["success"] = success
            }
            if let prompt = try? dataContainer.decode(String.self, forKey: .prompt) {
                dataDict["prompt"] = prompt
            }
            if let command = try? dataContainer.decode(String.self, forKey: .command) {
                dataDict["command"] = command
            }
            if let error = try? dataContainer.decode(String.self, forKey: .error) {
                dataDict["error"] = error
            }
            if let code = try? dataContainer.decode(String.self, forKey: .code) {
                dataDict["code"] = code
            }
            if let details = try? dataContainer.decode(String.self, forKey: .details) {
                dataDict["details"] = details
            }
            
            self.data = dataDict
        } else {
            self.data = [:]
        }
    }
    
    private enum CodingKeys: String, CodingKey {
        case type, data, timestamp
    }
    
    private enum DataCodingKeys: String, CodingKey {
        case text, isPartial, subject, description, callId, name, displayName, status, message, result, displayResult, success, prompt, command, error, code, details
    }
    
    func encode(to encoder: Encoder) throws {
        // 简化实现，主要用于测试
    }
}

// 测试函数
func testEventParsing(jsonString: String, eventName: String) {
    print("=== 测试 \(eventName) 事件解析 ===")
    
    guard let data = jsonString.data(using: .utf8) else {
        print("❌ 无法将测试字符串转换为数据")
        return
    }
    
    do {
        let event = try JSONDecoder().decode(TestStreamEvent.self, from: data)
        print("✅ JSON 解析成功")
        print("📝 事件类型: \(event.type)")
        print("📊 事件数据: \(event.data)")
        print("⏰ 时间戳: \(event.timestamp)")
        
        // 根据事件类型显示特定信息
        switch event.type {
        case "content":
            if let text = event.data["text"] as? String {
                print("📄 文本内容: \(text)")
            }
            if let isPartial = event.data["isPartial"] as? Bool {
                print("🔄 是否部分: \(isPartial)")
            }
        case "thought":
            if let subject = event.data["subject"] as? String {
                print("🧠 主题: \(subject)")
            }
            if let description = event.data["description"] as? String {
                print("📝 描述: \(description)")
            }
        case "tool_call":
            if let name = event.data["name"] as? String {
                print("🔧 工具名称: \(name)")
            }
            if let displayName = event.data["displayName"] as? String {
                print("📋 显示名称: \(displayName)")
            }
        case "tool_execution":
            if let status = event.data["status"] as? String {
                print("⚡ 执行状态: \(status)")
            }
            if let message = event.data["message"] as? String {
                print("💬 状态消息: \(message)")
            }
        case "tool_result":
            if let success = event.data["success"] as? Bool {
                print("✅ 执行成功: \(success)")
            }
            if let displayResult = event.data["displayResult"] as? String {
                print("📊 显示结果: \(displayResult)")
            }
        case "tool_confirmation":
            if let prompt = event.data["prompt"] as? String {
                print("❓ 确认提示: \(prompt)")
            }
        case "complete":
            if let success = event.data["success"] as? Bool {
                print("✅ 完成状态: \(success)")
            }
        case "error":
            if let message = event.data["message"] as? String {
                print("❌ 错误消息: \(message)")
            }
            if let code = event.data["code"] as? String {
                print("🔢 错误代码: \(code)")
            }
        default:
            print("❓ 未知事件类型")
        }
        
    } catch {
        print("❌ JSON 解析失败: \(error)")
    }
    
    print("")
}

// 运行所有测试
print("🚀 开始测试标准化流式事件格式")
print("")

testEventParsing(jsonString: testContentEvent, eventName: "Content")
testEventParsing(jsonString: testThoughtEvent, eventName: "Thought")
testEventParsing(jsonString: testToolCallEvent, eventName: "Tool Call")
testEventParsing(jsonString: testToolExecutionEvent, eventName: "Tool Execution")
testEventParsing(jsonString: testToolResultEvent, eventName: "Tool Result")
testEventParsing(jsonString: testToolConfirmationEvent, eventName: "Tool Confirmation")
testEventParsing(jsonString: testCompleteEvent, eventName: "Complete")
testEventParsing(jsonString: testErrorEvent, eventName: "Error")

print("✅ 所有测试完成") 