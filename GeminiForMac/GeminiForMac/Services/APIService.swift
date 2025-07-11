//
//  APIService.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/9.
//

import Foundation

// MARK: - API响应模型
struct MessageResponse: Codable {
    let success: Bool
    let response: String
    let hasToolCalls: Bool?
    let toolCalls: [ToolCall]?
    let timestamp: String
    let error: String?
    let message: String?
}

struct ToolCall: Codable {
    let id: String
    let name: String
    let args: [String: String]  // 简化为字符串字典
    
    enum CodingKeys: String, CodingKey {
        case id, name, args
    }
}

// MARK: - API服务类
final class APIService:Sendable {
    private let baseURL = "http://localhost:8080"
    private let decoder:JSONDecoder
    init(){
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = decoder
    }
    
    // 检查服务器状态
    func checkServerStatus() async -> Bool {
        guard let url = URL(string: "\(baseURL)/status") else { return false }
        
        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }
    
    // 发送消息（统一使用流式响应，让 AI 自动决定是否需要交互式处理）
    func sendMessage(_ text: String, filePaths: [String] = [], workspacePath: String? = nil) async -> MessageResponse? {
        guard let url = URL(string: "\(baseURL)/chat") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 按照标准化API规范发送请求
        var body: [String: Any] = [
            "message": text
            // 移除 stream 参数，统一使用流式响应
        ]
        
        // 添加文件路径和工作目录
        if !filePaths.isEmpty {
            body["filePaths"] = filePaths
        }
        if let workspacePath = workspacePath, !workspacePath.isEmpty {
            body["workspacePath"] = workspacePath
        }
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try decoder.decode(MessageResponse.self, from: data)
        } catch {
            print("解析响应失败: \(error)")
            return nil
        }
    }
    
    // 发送消息（流式响应）- 现在这是唯一的方式
    func sendMessageStream(_ text: String, filePaths: [String] = [], workspacePath: String? = nil) async -> AsyncThrowingStream<String, Error> {
        return AsyncThrowingStream { continuation in
            Task {
                guard let url = URL(string: "\(baseURL)/chat") else {
                    continuation.finish(throwing: URLError(.badURL))
                    return
                }
                
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                // 按照标准化API规范发送请求
                var body: [String: Any] = [
                    "message": text
                    // 移除 stream 参数，统一使用流式响应
                ]
                
                // 添加文件路径和工作目录
                if !filePaths.isEmpty {
                    body["filePaths"] = filePaths
                }
                if let workspacePath = workspacePath, !workspacePath.isEmpty {
                    body["workspacePath"] = workspacePath
                }
                
                request.httpBody = try? JSONSerialization.data(withJSONObject: body)
                
                do {
                    let (result, _) = try await URLSession.shared.bytes(for: request)
                    
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
    
    // 发送工具确认 - 修复API路径
    func sendToolConfirmation(callId: String, outcome: ToolConfirmationOutcome) async -> ToolConfirmationResponse? {
        guard let url = URL(string: "\(baseURL)/tool-confirmation") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 按照标准化API规范发送请求
        let body: [String: Any] = [
            "callId": callId,
            "outcome": outcome.rawValue
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try decoder.decode(ToolConfirmationResponse.self, from: data)
        } catch {
            print("解析工具确认响应失败: \(error)")
            return nil
        }
    }
    
    // MARK: - 认证功能
    
    // 设置认证配置
    func setAuthConfig(authType: AuthType, apiKey: String? = nil, googleCloudProject: String? = nil, googleCloudLocation: String? = nil) async -> AuthResponse? {
        guard let url = URL(string: "\(baseURL)/auth/config") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 按照标准化API规范发送请求
        var body: [String: Any] = [
            "authType": authType.rawValue
        ]
        
        if let apiKey = apiKey, !apiKey.isEmpty {
            body["apiKey"] = apiKey
        }
        if let googleCloudProject = googleCloudProject, !googleCloudProject.isEmpty {
            body["googleCloudProject"] = googleCloudProject
        }
        if let googleCloudLocation = googleCloudLocation, !googleCloudLocation.isEmpty {
            body["googleCloudLocation"] = googleCloudLocation
        }
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try decoder.decode(AuthResponse.self, from: data)
        } catch {
            print("解析认证配置响应失败: \(error)")
            return nil
        }
    }
    
    // 启动 Google 登录
    func startGoogleLogin() async -> AuthResponse? {
        print("发送 Google 登录请求...")
        
        guard let url = URL(string: "\(baseURL)/auth/google-login") else { 
            print("无法创建 Google 登录 URL")
            return nil 
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                print("Google 登录 HTTP 状态码: \(httpResponse.statusCode)")
            }
            
            print("Google 登录响应数据: \(String(data: data, encoding: .utf8) ?? "无法解码")")
            
            let authResponse = try decoder.decode(AuthResponse.self, from: data)
            print("Google 登录响应解析成功: \(authResponse)")
            return authResponse
        } catch {
            print("Google 登录请求失败: \(error)")
            return nil
        }
    }
    
    // 获取认证状态
    func getAuthStatus() async -> AuthStatusResponse? {
        guard let url = URL(string: "\(baseURL)/auth/status") else { return nil }
        
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            return try decoder.decode(AuthStatusResponse.self, from: data)
        } catch {
            print("解析认证状态响应失败: \(error)")
            return nil
        }
    }
    
    // 登出
    func logout() async -> AuthResponse? {
        guard let url = URL(string: "\(baseURL)/auth/logout") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try decoder.decode(AuthResponse.self, from: data)
        } catch {
            print("解析登出响应失败: \(error)")
            return nil
        }
    }
    
    // 清除认证配置
    func clearAuth() async -> AuthResponse? {
        guard let url = URL(string: "\(baseURL)/auth/clear") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try decoder.decode(AuthResponse.self, from: data)
        } catch {
            print("解析清除认证响应失败: \(error)")
            return nil
        }
    }
    
    // MARK: - 文件操作功能
    
    // 列出目录内容
    func listDirectory(path: String = ".") async -> DirectoryResponse? {
        guard let url = URL(string: "\(baseURL)/list-directory?path=\(path.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? path)") else { return nil }
        
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            return try decoder.decode(DirectoryResponse.self, from: data)
        } catch {
            print("解析目录列表响应失败: \(error)")
            return nil
        }
    }
    
    // 读取文件内容
    func readFile(path: String) async -> FileResponse? {
        guard let url = URL(string: "\(baseURL)/read-file") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = ["path": path]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try decoder.decode(FileResponse.self, from: data)
        } catch {
            print("解析文件读取响应失败: \(error)")
            return nil
        }
    }
    
    // 写入文件内容
    func writeFile(path: String, content: String) async -> FileResponse? {
        guard let url = URL(string: "\(baseURL)/write-file") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "path": path,
            "content": content
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try decoder.decode(FileResponse.self, from: data)
        } catch {
            print("解析文件写入响应失败: \(error)")
            return nil
        }
    }
    
    // 执行命令
    func executeCommand(command: String, cwd: String? = nil) async -> CommandResponse? {
        guard let url = URL(string: "\(baseURL)/execute-command") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        var body: [String: Any] = ["command": command]
        if let cwd = cwd, !cwd.isEmpty {
            body["cwd"] = cwd
        }
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try decoder.decode(CommandResponse.self, from: data)
        } catch {
            print("解析命令执行响应失败: \(error)")
            return nil
        }
    }
}
