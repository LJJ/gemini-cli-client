//
//  DiffView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/1/27.
//

import SwiftUI

// MARK: - 差异视图
struct DiffView: View {
    let diffContent: String
    let filename: String?
    
    @State private var parsedLines: [DiffLine] = []
    
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
            
            // 差异内容
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(parsedLines.enumerated()), id: \.offset) { index, line in
                        DiffLineView(line: line)
                    }
                }
            }
            .frame(maxHeight: 400)
            .background(Color(NSColor.textBackgroundColor))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.gray.opacity(0.3), lineWidth: 1)
            )
        }
        .onAppear {
            parseDiffContent()
        }
    }
    
    // MARK: - 解析差异内容
    private func parseDiffContent() {
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
    }
}

// MARK: - 差异行视图
struct DiffLineView: View {
    let line: DiffLine
    
    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // 行号
            HStack(spacing: 4) {
                if let oldLine = line.oldLineNumber {
                    Text("\(oldLine)")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.secondary)
                        .frame(width: 30, alignment: .trailing)
                } else {
                    Text("")
                        .frame(width: 30)
                }
                
                if let newLine = line.newLineNumber {
                    Text("\(newLine)")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.secondary)
                        .frame(width: 30, alignment: .trailing)
                } else {
                    Text("")
                        .frame(width: 30)
                }
            }
            
            // 差异标记
            Text(diffSymbol)
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(diffColor)
                .frame(width: 20, alignment: .center)
            
            // 内容
            Text(line.content)
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(diffColor)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 2)
        .background(backgroundColor)
    }
    
    // MARK: - 计算属性
    private var diffSymbol: String {
        switch line.type {
        case .add:
            return "+"
        case .delete:
            return "-"
        case .context:
            return " "
        case .hunk:
            return "@"
        case .other:
            return "\\"
        }
    }
    
    private var diffColor: Color {
        switch line.type {
        case .add:
            return .green
        case .delete:
            return .red
        case .context:
            return .primary
        case .hunk:
            return .blue
        case .other:
            return .secondary
        }
    }
    
    private var backgroundColor: Color {
        switch line.type {
        case .add:
            return Color.green.opacity(0.1)
        case .delete:
            return Color.red.opacity(0.1)
        case .context:
            return Color.clear
        case .hunk:
            return Color.blue.opacity(0.1)
        case .other:
            return Color.clear
        }
    }
}

#Preview {
    DiffView(
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