//
//  FileExplorerView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import SwiftUI

struct FileExplorerView: View {
    @StateObject private var fileExplorerService = FileExplorerService()
    @State private var searchText = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // 顶部工具栏
            HStack(spacing: 8) {
                // 后退按钮
                Button(action: {
                    fileExplorerService.goBack()
                }) {
                    Image(systemName: "chevron.left")
                        .font(.caption)
                }
                .disabled(!fileExplorerService.canGoBack)
                .buttonStyle(.plain)
                
                // 前进按钮
                Button(action: {
                    fileExplorerService.goForward()
                }) {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                }
                .disabled(!fileExplorerService.canGoForward)
                .buttonStyle(.plain)
                
                // 父目录按钮
                Button(action: {
                    fileExplorerService.navigateToParent()
                }) {
                    Image(systemName: "arrow.up")
                        .font(.caption)
                }
                .buttonStyle(.plain)
                
                Divider()
                    .frame(height: 16)
                
                // 刷新按钮
                Button(action: {
                    fileExplorerService.refresh()
                }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.caption)
                }
                .buttonStyle(.plain)
                
                Spacer()
                
                // 标题
                Text("文件浏览器")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(NSColor.controlBackgroundColor))
            
            Divider()
            
            // 搜索框
            HStack {
                Image(systemName: "magnifyingglass")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                TextField("搜索文件...", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.caption)
                
                if !searchText.isEmpty {
                    Button(action: {
                        searchText = ""
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color(NSColor.controlBackgroundColor))
            
            Divider()
            
            // 当前路径显示
            HStack {
                Text(fileExplorerService.currentPath)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 4)
            .background(Color(NSColor.controlBackgroundColor))
            
            Divider()
            
            // 文件列表
            if fileExplorerService.isLoading {
                VStack {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("加载中...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let errorMessage = fileExplorerService.errorMessage {
                VStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundColor(.orange)
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    
                    Button("重试") {
                        fileExplorerService.refresh()
                    }
                    .buttonStyle(.plain)
                    .font(.caption)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(filteredItems) { item in
                            FileItemView(
                                item: item,
                                isSelected: fileExplorerService.selectedItem?.id == item.id,
                                isExpanded: fileExplorerService.expandedFolders.contains(item.path)
                            ) {
                                // 单击：选择项目
                                if item.type == "directory" {
                                    fileExplorerService.selectDirectory(item)
                                } else {
                                    fileExplorerService.selectFile(item)
                                }
                            } onDoubleTap: {
                                // 双击：进入目录（仅对文件夹）
                                if item.type == "directory" {
                                    fileExplorerService.navigateToDirectory(item)
                                }
                            } onToggleExpansion: {
                                fileExplorerService.toggleFolderExpansion(item)
                            }
                        }
                    }
                }
            }
        }
        .frame(minWidth: 250, maxWidth: 350)
        .background(Color(NSColor.controlBackgroundColor))
    }
    
    // 过滤搜索结果
    private var filteredItems: [DirectoryItem] {
        if searchText.isEmpty {
            return fileExplorerService.items
        } else {
            return fileExplorerService.items.filter { item in
                item.name.localizedCaseInsensitiveContains(searchText)
            }
        }
    }
}


#Preview {
    FileExplorerView()
}
