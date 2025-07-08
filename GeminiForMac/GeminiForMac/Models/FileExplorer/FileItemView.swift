//
//  File.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/8.
//

import SwiftUI

// 文件项视图
struct FileItemView: View {
    let item: DirectoryItem
    let isSelected: Bool
    let isExpanded: Bool
    let onTap: () -> Void
    let onDoubleTap: () -> Void
    let onToggleExpansion: () -> Void
    
    var body: some View {
        HStack(spacing: 4) {
            // 展开/折叠按钮（仅对文件夹）
            if item.type == "directory" {
                Button(action: onToggleExpansion) {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .frame(width: 12, height: 12)
                }
                .buttonStyle(.plain)
                .allowsHitTesting(true)
            } else {
                // 文件占位符
                Rectangle()
                    .fill(Color.clear)
                    .frame(width: 12, height: 12)
            }
            
            // 文件图标和名称区域
            HStack(spacing: 4) {
                // 文件图标
                Image(systemName: iconName)
                    .font(.caption)
                    .foregroundColor(iconColor)
                    .frame(width: 16, height: 16)
                
                // 文件名
                Text(item.name)
                    .font(.caption)
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .contentShape(Rectangle())
            .onTapGesture(count: 2) {
                print("👆👆 双击: \(item.name)")
                onDoubleTap()
            }
            .simultaneousGesture(
                TapGesture(count: 1)
                    .onEnded {
                        print("👆 单击: \(item.name)")
                        onTap()
                    }
            )
            
            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
    }
    
    // 根据文件类型返回图标名称
    private var iconName: String {
        if item.type == "directory" {
            return isExpanded ? "folder.fill" : "folder"
        } else {
            // 根据文件扩展名返回不同图标
            let ext = (item.name as NSString).pathExtension.lowercased()
            switch ext {
            case "swift":
                return "swift"
            case "py":
                return "python"
            case "js", "ts":
                return "javascript"
            case "html", "htm":
                return "html"
            case "css":
                return "css"
            case "json":
                return "json"
            case "md":
                return "markdown"
            case "txt":
                return "doc.text"
            case "pdf":
                return "doc.richtext"
            case "jpg", "jpeg", "png", "gif":
                return "photo"
            default:
                return "doc"
            }
        }
    }
    
    // 图标颜色
    private var iconColor: Color {
        if item.type == "directory" {
            return .blue
        } else {
            let ext = (item.name as NSString).pathExtension.lowercased()
            switch ext {
            case "swift":
                return .orange
            case "py":
                return .blue
            case "js", "ts":
                return .yellow
            case "html", "htm":
                return .red
            case "css":
                return .blue
            case "json":
                return .green
            case "md":
                return .purple
            default:
                return .secondary
            }
        }
    }
}
