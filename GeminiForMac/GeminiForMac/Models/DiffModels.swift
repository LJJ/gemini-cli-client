//
//  DiffModels.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/1/27.
//

import Foundation

// MARK: - 差异行类型
enum DiffLineType {
    case add      // 新增行
    case delete   // 删除行
    case context  // 上下文行
    case hunk     // 差异块头部
    case other    // 其他
}

// MARK: - 差异行数据
struct DiffLine {
    let type: DiffLineType
    let oldLineNumber: Int?
    let newLineNumber: Int?
    let content: String
} 