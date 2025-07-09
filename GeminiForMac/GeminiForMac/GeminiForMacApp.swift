//
//  GeminiForMacApp.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import SwiftUI

@main
struct GeminiForMacApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        .commands {
            // 添加自定义菜单
            CommandGroup(after: .appInfo) {
                Divider()
                
                Button("切换认证方式") {
                    // 通过通知中心发送通知
                    NotificationCenter.default.post(name: NSNotification.Name("switchAuthMethod"), object: nil)
                }
                .keyboardShortcut("l", modifiers: [.command, .shift])
                
                Button("登出") {
                    // 通过通知中心发送通知
                    NotificationCenter.default.post(name: NSNotification.Name("logout"), object: nil)
                }
                .keyboardShortcut("o", modifiers: [.command, .shift])
            }
        }
    }
}
