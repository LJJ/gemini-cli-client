//
//  APIService.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/9.
//

import Foundation

// MARK: - API响应模型
struct MessageResponse: Codable {
    let response: String
    let success: Bool
    let error: String?
}

// MARK: - API服务类
class APIService {
    private let baseURL = "http://localhost:8080"
    
    // 检查服务器状态
    func checkServerStatus() async -> Bool {
        guard let url = URL(string: "\(baseURL)/auth/status") else { return false }
        
        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }
    
    // 发送消息（普通响应）
    func sendMessage(_ text: String, filePaths: [String] = [], workspacePath: String? = nil) async -> MessageResponse? {
        guard let url = URL(string: "\(baseURL)/chat") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "message": text,
            "filePaths": filePaths,
            "workspacePath": workspacePath ?? ""
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try JSONDecoder().decode(MessageResponse.self, from: data)
        } catch {
            return nil
        }
    }
    
    // 发送消息（流式响应）
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
                
                let body: [String: Any] = [
                    "message": text,
                    "filePaths": filePaths,
                    "workspacePath": workspacePath ?? ""
                ]
                
                request.httpBody = try? JSONSerialization.data(withJSONObject: body)
                
                do {
                    let (result, _) = try await URLSession.shared.bytes(for: request)
                    
                    for try await line in result.lines {
                        if !line.isEmpty {
                            // 尝试解析JSON事件，如果失败则作为普通文本返回
                            if let data = line.data(using: .utf8),
                               let _ = try? JSONSerialization.jsonObject(with: data) {
                                // 是有效的JSON，直接返回
                                continuation.yield(line)
                            } else {
                                // 不是JSON，作为普通文本返回
                                continuation.yield(line)
                            }
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }
    
    // 发送工具确认
    func sendToolConfirmation(callId: String, outcome: ToolConfirmationOutcome) async -> ToolConfirmationResponse? {
        guard let url = URL(string: "\(baseURL)/tools/confirm") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "callId": callId,
            "outcome": outcome.rawValue
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try JSONDecoder().decode(ToolConfirmationResponse.self, from: data)
        } catch {
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
        
        let body: [String: Any] = [
            "authType": authType.rawValue,
            "apiKey": apiKey ?? "",
            "googleCloudProject": googleCloudProject ?? "",
            "googleCloudLocation": googleCloudLocation ?? ""
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try JSONDecoder().decode(AuthResponse.self, from: data)
        } catch {
            return nil
        }
    }
    
    // 启动 Google 登录
    func startGoogleLogin() async -> AuthResponse? {
        guard let url = URL(string: "\(baseURL)/auth/google-login") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try JSONDecoder().decode(AuthResponse.self, from: data)
        } catch {
            return nil
        }
    }
    
    // MARK: - 文件操作功能
    
    // 列出目录内容
    func listDirectory(path: String = ".") async -> DirectoryResponse? {
        guard let url = URL(string: "\(baseURL)/list-directory?path=\(path.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? path)") else { return nil }
        
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            return try JSONDecoder().decode(DirectoryResponse.self, from: data)
        } catch {
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
            return try JSONDecoder().decode(FileResponse.self, from: data)
        } catch {
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
            return try JSONDecoder().decode(FileResponse.self, from: data)
        } catch {
            return nil
        }
    }
    
    // 执行命令
    func executeCommand(command: String, cwd: String? = nil) async -> CommandResponse? {
        guard let url = URL(string: "\(baseURL)/execute-command") else { return nil }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "command": command,
            "cwd": cwd ?? ""
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try JSONDecoder().decode(CommandResponse.self, from: data)
        } catch {
            return nil
        }
    }
}
