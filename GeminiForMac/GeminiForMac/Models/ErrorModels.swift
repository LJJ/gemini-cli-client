//
//  ErrorModels.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation

// MARK: - 错误类型
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