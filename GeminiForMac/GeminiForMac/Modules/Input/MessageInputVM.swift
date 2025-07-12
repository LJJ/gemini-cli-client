//
//  MessageInputVM.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/12.
//

import Foundation
import SwiftUI
import Factory

@MainActor
class MessageInputVM: ObservableObject {
    @Injected(\.fileExplorerService) private var fileExplorerService
    @Injected(\.chatService) private var chatService
    
    @Published var messageText: String = ""
    @Published var currentModel: ModelInfo?
    @Published var supportedModels: [ModelInfo] = []
    @Published var showModelMenu: Bool = false
    @Published var isLoadingModels: Bool = false
    
    init() {
        Task {
            await fetchModelStatus()
        }
    }
    
    func sendMessage() {
        let text = messageText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        
        messageText = ""
        
        Task {
            // 获取选中的文件路径
            let selectedFilePaths = Array(fileExplorerService.selectedFiles)
            
            // 发送消息（包含文件路径和工作目录）
            await chatService.sendMessage(text, filePaths: selectedFilePaths, workspacePath: fileExplorerService.currentPath)
        }
    }
    
    func fetchModelStatus() async {
        isLoadingModels = true
        
        do {
            let url = URL(string: APIConfig.URLs.modelStatus)!
            let (data, _) = try await URLSession.shared.data(from: url)
            
            let response = try JSONDecoder().decode(ModelStatusResponse.self, from: data)
            
            // 更新支持的模型列表
            supportedModels = response.data.supportedModels.map { model in
                ModelInfo(name: model.name, isAvailable: model.isAvailable)
            }
            
            // 更新当前模型
            currentModel = ModelInfo(name: response.data.currentModel, isAvailable: true)
            
        } catch {
            print("获取模型状态失败: \(error)")
            // 设置默认值
            currentModel = ModelInfo(name: "gemini-2.5-flash", isAvailable: true)
            supportedModels = [
                ModelInfo(name: "gemini-2.5-pro", isAvailable: false),
                ModelInfo(name: "gemini-2.5-flash", isAvailable: true)
            ]
        }
        
        isLoadingModels = false
    }
    
    func switchModel(to modelName: String) async {
        guard let targetModel = supportedModels.first(where: { $0.name == modelName }) else {
            return
        }
        
        do {
            let url = URL(string: APIConfig.URLs.modelSwitch)!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = ["model": modelName]
            request.httpBody = try JSONEncoder().encode(body)
            
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(ModelSwitchResponse.self, from: data)
            
            if response.success {
                currentModel = targetModel
                showModelMenu = false
            } else {
                print(response.message ?? "切换模型失败")
            }
            
        } catch {
            print("切换模型失败: \(error)")
        }
    }
}
