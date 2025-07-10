//
//  SideBySideDiffView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/1/27.
//

import SwiftUI
struct SideBySideDiffView: View {
    let diffContent: String?
    let filename: String?
    let oldContent: String?
    let newContent: String?
    
    @State private var parsedLines: [DiffLine] = []
    @State private var oldCode: String = ""
    @State private var newCode: String = ""
    
    // 构造函数1：用于 diff 格式
    init(diffContent: String, filename: String?) {
        self.diffContent = diffContent
        self.filename = filename
        self.oldContent = nil
        self.newContent = nil
    }
    
    // 构造函数2：用于直接传入 old/new 内容
    init(oldContent: String, newContent: String, filename: String?) {
        self.diffContent = nil
        self.filename = filename
        self.oldContent = oldContent
        self.newContent = newContent
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 文件名标题
            if let filename = filename {
                HStack {
                    Image(systemName: "doc.text")
                        .foregroundColor(.blue)
                    Text(filename)
                        .font(.headline)
                        .fontWeight(.semibold)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)
                .padding(.bottom, 12)
            }
            
            // 并排对比内容
            HStack(spacing: 0) {
                // 左侧：旧代码
                VStack(alignment: .leading, spacing: 0) {
                    // 标题
                    HStack {
                        Image(systemName: "minus.circle.fill")
                            .foregroundColor(.red)
                        Text("旧代码")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Spacer()
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.red.opacity(0.1))
                    
                    // 代码内容
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(Array(oldCodeLines.enumerated()), id: \.offset) { index, line in
                                SideBySideLineView(
                                    line: line,
                                    lineNumber: index + 1,
                                    isOldCode: true
                                )
                            }
                        }
                    }
                    .frame(maxHeight: 400)
                    .background(Color(NSColor.textBackgroundColor))
                }
                .frame(maxWidth: .infinity)
                .overlay(
                    Rectangle()
                        .frame(width: 1)
                        .foregroundColor(Color.gray.opacity(0.3)),
                    alignment: .trailing
                )
                
                // 右侧：新代码
                VStack(alignment: .leading, spacing: 0) {
                    // 标题
                    HStack {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.green)
                        Text("新代码")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Spacer()
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.green.opacity(0.1))
                    
                    // 代码内容
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(Array(newCodeLines.enumerated()), id: \.offset) { index, line in
                                SideBySideLineView(
                                    line: line,
                                    lineNumber: index + 1,
                                    isOldCode: false
                                )
                            }
                        }
                    }
                    .frame(maxHeight: 400)
                    .background(Color(NSColor.textBackgroundColor))
                }
                .frame(maxWidth: .infinity)
            }
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
            )
        }
        .onAppear {
            if let diffContent = diffContent {
                parseDiffContent(diffContent)
            } else if let oldContent = oldContent, let newContent = newContent {
                setDirectContent(oldContent: oldContent, newContent: newContent)
            }
        }
    }
    
    // MARK: - 计算属性
    private var oldCodeLines: [String] {
        return oldCode.components(separatedBy: .newlines)
    }
    
    private var newCodeLines: [String] {
        return newCode.components(separatedBy: .newlines)
    }
    
    // MARK: - 解析差异内容
    private func parseDiffContent(_ diffContent: String) {
        let lines = diffContent.components(separatedBy: .newlines)
        var result: [DiffLine] = []
        var currentOldLine = 0
        var currentNewLine = 0
        var inHunk = false
        
        // 差异块头部正则表达式
        let hunkHeaderRegex = try! NSRegularExpression(pattern: "^@@ -(\\d+),?\\d* \\+(\\d+),?\\d* @@")
        
        for line in lines {
            // 检查是否是差异块头部
            let range = NSRange(location: 0, length: line.utf16.count)
            let hunkMatch = hunkHeaderRegex.firstMatch(in: line, range: range)
            
            if let match = hunkMatch {
                let oldLineRange = Range(match.range(at: 1), in: line)!
                let newLineRange = Range(match.range(at: 2), in: line)!
                currentOldLine = Int(line[oldLineRange])!
                currentNewLine = Int(line[newLineRange])!
                inHunk = true
                
                result.append(DiffLine(type: .hunk, oldLineNumber: nil, newLineNumber: nil, content: line))
                
                // 调整起始行号
                currentOldLine -= 1
                currentNewLine -= 1
                continue
            }
            
            if !inHunk {
                // 跳过标准Git头部行
                if line.hasPrefix("--- ") || line.hasPrefix("+++ ") || 
                   line.hasPrefix("diff --git") || line.hasPrefix("index ") ||
                   line.hasPrefix("similarity index") || line.hasPrefix("rename from") ||
                   line.hasPrefix("rename to") || line.hasPrefix("new file mode") ||
                   line.hasPrefix("deleted file mode") {
                    continue
                }
                continue
            }
            
            if line.hasPrefix("+") {
                currentNewLine += 1
                result.append(DiffLine(
                    type: .add,
                    oldLineNumber: nil,
                    newLineNumber: currentNewLine,
                    content: String(line.dropFirst())
                ))
            } else if line.hasPrefix("-") {
                currentOldLine += 1
                result.append(DiffLine(
                    type: .delete,
                    oldLineNumber: currentOldLine,
                    newLineNumber: nil,
                    content: String(line.dropFirst())
                ))
            } else if line.hasPrefix(" ") {
                currentOldLine += 1
                currentNewLine += 1
                result.append(DiffLine(
                    type: .context,
                    oldLineNumber: currentOldLine,
                    newLineNumber: currentNewLine,
                    content: String(line.dropFirst())
                ))
            } else if line.hasPrefix("\\") {
                result.append(DiffLine(type: .other, oldLineNumber: nil, newLineNumber: nil, content: line))
            }
        }
        
        parsedLines = result
        generateSideBySideCode()
    }
    
    // MARK: - 设置直接内容
    private func setDirectContent(oldContent: String, newContent: String) {
        oldCode = oldContent
        newCode = newContent
    }
    
    // MARK: - 生成并排代码
    private func generateSideBySideCode() {
        var oldLines: [String] = []
        var newLines: [String] = []
        
        for line in parsedLines {
            switch line.type {
            case .add:
                // 只在右侧添加新行
                newLines.append(line.content)
            case .delete:
                // 只在左侧添加删除的行
                oldLines.append(line.content)
            case .context:
                // 在两侧都添加上下文行
                oldLines.append(line.content)
                newLines.append(line.content)
            case .hunk, .other:
                // 跳过差异块头部和其他行
                break
            }
        }
        
        oldCode = oldLines.joined(separator: "\n")
        newCode = newLines.joined(separator: "\n")
    }
}

// MARK: - 并排行视图
struct SideBySideLineView: View {
    let line: String
    let lineNumber: Int
    let isOldCode: Bool
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // 行号
            Text("\(lineNumber)")
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.secondary)
                .frame(width: 40, alignment: .trailing)
            
            // 代码内容
            Text(line)
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.primary)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 2)
        .background(backgroundColor)
    }
    
    private var backgroundColor: Color {
        if isOldCode {
            return Color.red.opacity(0.05)
        } else {
            return Color.green.opacity(0.05)
        }
    }
}

#Preview {
    SideBySideDiffView(
        diffContent: """
        --- a/test.ts
        +++ b/test.ts
        @@ -1,3 +1,4 @@
         export function getAvailablePort(): Promise<number> {
           return new Promise((resolve, reject) => {
             let port = 0;
        +    console.log("Starting port acquisition");
             try {
               const server = net.createServer();
               server.listen(0, () => {
        @@ -8,6 +9,7 @@
               });
               server.on('error', (e) => reject(e));
               server.on('close', () => resolve(port));
        +    console.log("Port acquisition completed");
             } catch (e) {
               reject(e);
             }
           });
         }
        """,
        filename: "test.ts"
    )
    .padding()
} 
