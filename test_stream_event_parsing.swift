import Foundation

// 测试数据解析
let testContentEvent = """
{"type":"content","data":{"text":"正在处理您的请求...","isPartial":true},"timestamp":"2025-07-09T10:27:52.699Z"}
"""

let testThoughtEvent = """
{"type":"thought","data":{"subject":"Considering a Response","description":"I've considered the user's request – a Chinese joke is needed. Currently formulating a suitable punchline. The process is rather direct, but ensuring the joke translates well is a priority. Text output seems the most efficient method."},"timestamp":"2025-07-09T10:23:42.369Z"}
"""

// 这里需要导入 StreamEvent 模型
// 由于这是独立测试文件，我们直接测试 JSON 解析逻辑

func testContentEventParsing() {
    guard let data = testContentEvent.data(using: .utf8) else {
        print("❌ 无法将测试字符串转换为数据")
        return
    }
    
    do {
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        print("✅ JSON 解析成功")
        
        if let type = json?["type"] as? String {
            print("📝 事件类型: \(type)")
        }
        
        if let eventData = json?["data"] as? [String: Any] {
            print("📊 事件数据: \(eventData)")
            
            if let text = eventData["text"] as? String {
                print("📄 文本内容: \(text)")
            }
            
            if let isPartial = eventData["isPartial"] as? Bool {
                print("🔄 是否部分: \(isPartial)")
            }
        }
        
        if let timestamp = json?["timestamp"] as? String {
            print("⏰ 时间戳: \(timestamp)")
        }
        
    } catch {
        print("❌ JSON 解析失败: \(error)")
    }
}

func testThoughtEventParsing() {
    guard let data = testThoughtEvent.data(using: .utf8) else {
        print("❌ 无法将测试字符串转换为数据")
        return
    }
    
    do {
        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        print("✅ JSON 解析成功")
        
        if let type = json?["type"] as? String {
            print("📝 事件类型: \(type)")
        }
        
        if let eventData = json?["data"] as? [String: Any] {
            print("📊 事件数据: \(eventData)")
            
            if let subject = eventData["subject"] as? String {
                print("🧠 主题: \(subject)")
            }
            
            if let description = eventData["description"] as? String {
                print("📝 描述: \(description)")
            }
        }
        
        if let timestamp = json?["timestamp"] as? String {
            print("⏰ 时间戳: \(timestamp)")
        }
        
    } catch {
        print("❌ JSON 解析失败: \(error)")
    }
}

print("=== 测试 Content 事件解析 ===")
testContentEventParsing()

print("\n=== 测试 Thought 事件解析 ===")
testThoughtEventParsing() 