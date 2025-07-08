//
//  APIService.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation

class APIService: ObservableObject {
    private let baseURL = "http://127.0.0.1:8080"
    private let session: URLSession
    
    init() {
        // 创建自定义的 URLSession 配置，绕过代理
        let config = URLSessionConfiguration.default
        config.connectionProxyDictionary = [
            kCFNetworkProxiesHTTPEnable: false,
            kCFNetworkProxiesHTTPSEnable: false,
            kCFNetworkProxiesSOCKSEnable: false
        ]
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 30
        
        // 添加额外的网络配置
        config.allowsCellularAccess = true
        config.allowsExpensiveNetworkAccess = true
        config.allowsConstrainedNetworkAccess = true
        
        self.session = URLSession(configuration: config)
    }
    
    // 检查服务器状态
    func checkServerStatus() async -> Bool {
        guard let url = URL(string: "\(baseURL)/status") else { return false }
        
        do {
            let (data, _) = try await session.data(from: url)
            let response = try JSONDecoder().decode(StatusResponse.self, from: data)
            return response.status == "ok"
        } catch {
            print("服务器状态检查失败: \(error)")
            return false
        }
    }
    
    // 发送聊天消息
    func sendMessage(_ text: String) async -> ChatResponse? {
        guard let url = URL(string: "\(baseURL)/chat") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ChatRequest(message: text, stream: false)
        request.httpBody = try? JSONEncoder().encode(body)
        
        do {
            let (data, _) = try await session.data(for: request)
            return try JSONDecoder().decode(ChatResponse.self, from: data)
        } catch {
            print("发送消息失败: \(error)")
            return nil
        }
    }
    
    // 流式发送消息
    func sendMessageStream(_ text: String) async -> AsyncThrowingStream<String, Error> {
        return AsyncThrowingStream { continuation in
            Task {
                guard let url = URL(string: "\(baseURL)/chat") else {
                    continuation.finish(throwing: APIError.invalidURL)
                    return
                }
                
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let body = ChatRequest(message: text, stream: true)
                request.httpBody = try? JSONEncoder().encode(body)
                
                do {
                    let (result, _) = try await session.bytes(for: request)
                    
                    for try await line in result.lines {
                        if !line.isEmpty {
                            continuation.yield(line)
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
    
    // MARK: - 文件操作功能
    
    // 列出目录内容
    func listDirectory(path: String = ".") async -> DirectoryResponse? {
        guard let url = URL(string: "\(baseURL)/list-directory?path=\(path.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? path)") else { return nil }
        
        do {
            let (data, _) = try await session.data(from: url)
            return try JSONDecoder().decode(DirectoryResponse.self, from: data)
        } catch {
            print("列出目录失败: \(error)")
            return nil
        }
    }
    
    // 读取文件内容
    func readFile(path: String) async -> FileResponse? {
        guard let url = URL(string: "\(baseURL)/read-file") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = FileRequest(path: path)
        request.httpBody = try? JSONEncoder().encode(body)
        
        do {
            let (data, _) = try await session.data(for: request)
            return try JSONDecoder().decode(FileResponse.self, from: data)
        } catch {
            print("读取文件失败: \(error)")
            return nil
        }
    }
    
    // 写入文件内容
    func writeFile(path: String, content: String) async -> FileResponse? {
        guard let url = URL(string: "\(baseURL)/write-file") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = FileWriteRequest(path: path, content: content)
        request.httpBody = try? JSONEncoder().encode(body)
        
        do {
            let (data, _) = try await session.data(for: request)
            return try JSONDecoder().decode(FileResponse.self, from: data)
        } catch {
            print("写入文件失败: \(error)")
            return nil
        }
    }
    
    // 执行命令
    func executeCommand(command: String, cwd: String? = nil) async -> CommandResponse? {
        guard let url = URL(string: "\(baseURL)/execute-command") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = CommandRequest(command: command, cwd: cwd)
        request.httpBody = try? JSONEncoder().encode(body)
        
        do {
            let (data, _) = try await session.data(for: request)
            return try JSONDecoder().decode(CommandResponse.self, from: data)
        } catch {
            print("执行命令失败: \(error)")
            return nil
        }
    }
}

// 错误类型
enum APIError: Error, LocalizedError {
    case invalidURL
    case networkError
    case decodingError
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "无效的 URL"
        case .networkError:
            return "网络错误"
        case .decodingError:
            return "数据解析错误"
        }
    }
} 