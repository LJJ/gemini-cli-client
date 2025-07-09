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

// 命令响应
struct CommandResponse: Codable {
    let command: String
    let output: String
    let error: String?
    let exitCode: Int
    let timestamp: String
} 