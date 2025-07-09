//
//  CommandModels.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation

// MARK: - 命令执行模型

// 命令请求
struct CommandRequest: Codable {
    let command: String
    let cwd: String?
}

// 命令响应 - 更新为标准化格式
struct CommandResponse: Codable {
    let success: Bool
    let command: String
    let output: String
    let stderr: String?  // 重命名为stderr避免与BaseResponse.error冲突
    let exitCode: Int
    let timestamp: String
    let error: String?
    let message: String?
} 