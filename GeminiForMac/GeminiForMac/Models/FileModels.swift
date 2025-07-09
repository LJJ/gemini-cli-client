//
//  FileModels.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation

// MARK: - 文件操作模型

// 目录项
struct DirectoryItem: Codable, Identifiable {
    let id = UUID()
    let name: String
    let type: String // "directory" 或 "file"
    let path: String
    
    enum CodingKeys: String, CodingKey {
        case name, type, path
    }
}

// 目录响应 - 更新为标准化格式
struct DirectoryResponse: Codable {
    let success: Bool
    let path: String
    let items: [DirectoryItem]
    let timestamp: String
    let error: String?
    let message: String?
}

// 文件响应 - 更新为标准化格式
struct FileResponse: Codable {
    let success: Bool
    let path: String
    let content: String?
    let message: String?
    let timestamp: String
    let error: String?
}

// 文件请求
struct FileRequest: Codable {
    let path: String
}

// 文件写入请求
struct FileWriteRequest: Codable {
    let path: String
    let content: String
} 