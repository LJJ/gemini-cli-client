//
//  MarkdownTextView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import SwiftUI
import Foundation
import MarkdownUI

struct MarkdownTextView: View {
    let text: String
    
    var body: some View {
        ScrollView {
            Markdown(text)
				.markdownTextStyle(textStyle: {
					BackgroundColor(nil)
				})
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    VStack(alignment: .leading, spacing: 16) {
        MarkdownTextView(text: "这是普通文本")
        
        MarkdownTextView(text: "**这是粗体文本**")
        
        MarkdownTextView(text: "*这是斜体文本*")
        
        MarkdownTextView(text: "`这是行内代码`")
        
        MarkdownTextView(text: """
        # 标题 1
        ## 标题 2
        ### 标题 3
        
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
        
        MarkdownTextView(text: """
        > 这是一个引用块
        > 可以包含多行内容
        
        | 表头1 | 表头2 |
        |-------|-------|
        | 单元格1 | 单元格2 |
        | 单元格3 | 单元格4 |
        """)
    }
    .padding()
} 
