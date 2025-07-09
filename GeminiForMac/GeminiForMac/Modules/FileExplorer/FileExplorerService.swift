//
//  FileExplorerService.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation
import SwiftUI

@MainActor
class FileExplorerService: ObservableObject {
    @Published var currentPath = "."
    @Published var items: [DirectoryItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedItem: DirectoryItem?
    @Published var expandedFolders: Set<String> = []
    
    // 多选功能
    @Published var selectedFiles: Set<String> = [] // 存储选中文件的路径
    @Published var isMultiSelectMode = false
    
    private let apiService = APIService()
    
    // 路径历史记录
    @Published var pathHistory: [String] = []
    @Published var currentHistoryIndex = -1
    
    init() {
        loadCurrentDirectory()
    }
    
    // 加载当前目录
    func loadCurrentDirectory() {
        Task {
            await loadDirectory(path: currentPath)
        }
    }
    
    // 加载指定目录
    func loadDirectory(path: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            if let response = await apiService.listDirectory(path: path) {
                currentPath = response.path
                items = response.items.sorted { item1, item2 in
                    // 文件夹在前，然后按名称排序
                    if item1.type == "directory" && item2.type == "file" {
                        return true
                    } else if item1.type == "file" && item2.type == "directory" {
                        return false
                    } else {
                        return item1.name.localizedCaseInsensitiveCompare(item2.name) == .orderedAscending
                    }
                }
                
                // 添加到历史记录
                addToHistory(path)
            } else {
                errorMessage = "无法加载目录内容"
            }
        } catch {
            errorMessage = "加载目录失败: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    // 导航到父目录
    func navigateToParent() {
        let parentPath = (currentPath as NSString).deletingLastPathComponent
        if parentPath.isEmpty || parentPath == "." {
            return
        }
        Task {
            await loadDirectory(path: parentPath)
        }
    }
    
    // 导航到指定目录
    func navigateToDirectory(_ item: DirectoryItem) {
        guard item.type == "directory" else { return }
        print("🔄 双击进入目录: \(item.name) - \(item.path)")
        Task {
            await loadDirectory(path: item.path)
        }
    }
    
    // 选择文件
    func selectFile(_ item: DirectoryItem) {
        guard item.type == "file" else { return }
        selectedItem = item
    }
    
    // 选择目录
    func selectDirectory(_ item: DirectoryItem) {
        guard item.type == "directory" else { return }
        selectedItem = item
    }
    
    // MARK: - 多选功能
    
    // 切换多选模式
    func toggleMultiSelectMode() {
        isMultiSelectMode.toggle()
        if !isMultiSelectMode {
            // 退出多选模式时清空选择
            selectedFiles.removeAll()
        }
    }
    
    // 切换文件选择状态
    func toggleFileSelection(_ item: DirectoryItem) {
        guard item.type == "file" else { return }
        
        if selectedFiles.contains(item.path) {
            selectedFiles.remove(item.path)
        } else {
            selectedFiles.insert(item.path)
        }
    }
    
    // 检查文件是否被选中
    func isFileSelected(_ item: DirectoryItem) -> Bool {
        return selectedFiles.contains(item.path)
    }
    
    // 清空所有选择
    func clearSelection() {
        selectedFiles.removeAll()
    }
    
    // 获取选中的文件列表
    var selectedFileItems: [DirectoryItem] {
        return items.filter { item in
            item.type == "file" && selectedFiles.contains(item.path)
        }
    }
    
    // 切换文件夹展开状态
    func toggleFolderExpansion(_ item: DirectoryItem) {
        guard item.type == "directory" else { return }
        if expandedFolders.contains(item.path) {
            expandedFolders.remove(item.path)
        } else {
            expandedFolders.insert(item.path)
        }
    }
    
    // 刷新当前目录
    func refresh() {
        loadCurrentDirectory()
    }
    
    // 搜索文件
    func searchFiles(query: String) {
        // 这里可以实现搜索功能
        // 暂时只是简单过滤
    }
    
    // MARK: - 历史记录管理
    
    private func addToHistory(_ path: String) {
        // 如果当前不在历史记录的最后，删除后面的记录
        if currentHistoryIndex < pathHistory.count - 1 {
            pathHistory = Array(pathHistory.prefix(currentHistoryIndex + 1))
        }
        
        // 添加新路径
        pathHistory.append(path)
        currentHistoryIndex = pathHistory.count - 1
    }
    
    // 后退
    func goBack() {
        guard canGoBack else { return }
        currentHistoryIndex -= 1
        let path = pathHistory[currentHistoryIndex]
        Task {
            await loadDirectory(path: path)
        }
    }
    
    // 前进
    func goForward() {
        guard canGoForward else { return }
        currentHistoryIndex += 1
        let path = pathHistory[currentHistoryIndex]
        Task {
            await loadDirectory(path: path)
        }
    }
    
    // 是否可以后退
    var canGoBack: Bool {
        return currentHistoryIndex > 0
    }
    
    // 是否可以前进
    var canGoForward: Bool {
        return currentHistoryIndex < pathHistory.count - 1
    }
} 