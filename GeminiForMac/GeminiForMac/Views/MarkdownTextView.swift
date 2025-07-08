//
//  MarkdownTextView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import SwiftUI
import Foundation

struct MarkdownTextView: View {
    let text: String
    
    var body: some View {
        Text(attributedString)
            .font(.body)
            .foregroundColor(.primary)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    private var attributedString: AttributedString {
        do {
            // 尝试将 Markdown 转换为 AttributedString
            var attributedString = try AttributedString(markdown: text)
            
            // 设置基本样式
            attributedString.font = .body
            
            // 为代码块添加特殊样式
            attributedString.foregroundColor = .primary
            
            return attributedString
        } catch {
            // 如果 Markdown 解析失败，返回普通文本
            var fallbackString = AttributedString(text)
            fallbackString.font = .body
            return fallbackString
        }
    }
}

#Preview {
    VStack(alignment: .leading, spacing: 16) {
        MarkdownTextView(text: "这是普通文本")
        
        MarkdownTextView(text: "**这是粗体文本**")
        
        MarkdownTextView(text: "*这是斜体文本*")
        
        MarkdownTextView(text: "`这是代码`")
        
        MarkdownTextView(text: """
        # 标题 1
        ## 标题 2
        
        这是一个段落。
        
        - 列表项 1
        - 列表项 2
        
        1. 有序列表 1
        2. 有序列表 2
        """)
        
        MarkdownTextView(text: """
        ```swift
        func hello() {
            print("Hello, World!")
        }
        ```
        """)
    }
    .padding()
} 