//
//  AuthService.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/9.
//

import Foundation
import SwiftUI

@MainActor
class AuthService: ObservableObject {
    @Published var authStatus: AuthStatus = .notAuthenticated
    @Published var currentAuthType: AuthType?
    @Published var showAuthDialog = false
    @Published var errorMessage: String?
    
    private let userDefaults = UserDefaults.standard
    private let authConfigKey = "GeminiForMac_AuthConfig"
    
    init() {
        loadSavedAuthConfig()
    }
    
    // MARK: - 认证配置管理
    
    private func loadSavedAuthConfig() {
        if let data = userDefaults.data(forKey: authConfigKey),
           let config = try? JSONDecoder().decode(AuthConfig.self, from: data) {
            currentAuthType = config.authType
            authStatus = .authenticated
        } else {
            // 没有保存的认证配置，显示认证对话框
            showAuthDialog = true
        }
    }
    
    private func saveAuthConfig(_ config: AuthConfig) {
        if let data = try? JSONEncoder().encode(config) {
            userDefaults.set(data, forKey: authConfigKey)
        }
    }
    
    func clearAuthConfig() {
        userDefaults.removeObject(forKey: authConfigKey)
        currentAuthType = nil
        authStatus = .notAuthenticated
        showAuthDialog = true
    }
    
    // MARK: - 认证验证
    
    func validateAuthMethod(_ authType: AuthType, apiKey: String? = nil, googleCloudProject: String? = nil, googleCloudLocation: String? = nil) -> String? {
        switch authType {
        case .loginWithGoogle:
            return nil // Google 登录不需要额外验证
            
        case .useGemini:
            if apiKey?.isEmpty != false {
                return "请输入 Gemini API Key"
            }
            return nil
            
        case .useVertexAI:
            if apiKey?.isEmpty != false {
                return "请输入 Google API Key"
            }
            if googleCloudProject?.isEmpty != false {
                return "请输入 Google Cloud Project ID"
            }
            if googleCloudLocation?.isEmpty != false {
                return "请输入 Google Cloud Location"
            }
            return nil
        }
    }
    
    // MARK: - 认证处理
    
    func authenticate(authType: AuthType, apiKey: String? = nil, googleCloudProject: String? = nil, googleCloudLocation: String? = nil) async {
        // 验证认证方法
        if let error = validateAuthMethod(authType, apiKey: apiKey, googleCloudProject: googleCloudProject, googleCloudLocation: googleCloudLocation) {
            authStatus = .error(error)
            errorMessage = error
            return
        }
        
        authStatus = .authenticating
        errorMessage = nil
        
        do {
            // 创建认证配置
            let config = AuthConfig(
                authType: authType,
                apiKey: apiKey,
                googleCloudProject: googleCloudProject,
                googleCloudLocation: googleCloudLocation
            )
            
            // 保存认证配置
            saveAuthConfig(config)
            currentAuthType = authType
            
            // 与服务器端通信
            let apiService = APIService()
            
            // 设置认证配置
            if let response = await apiService.setAuthConfig(
                authType: authType,
                apiKey: apiKey,
                googleCloudProject: googleCloudProject,
                googleCloudLocation: googleCloudLocation
            ) {
                if response.success {
                    // 根据认证类型处理
                    switch authType {
                    case .loginWithGoogle:
                        // Google 登录需要服务器端处理
                        await handleGoogleLogin()
                        
                    case .useGemini, .useVertexAI:
                        // API Key 认证直接完成
                        authStatus = .authenticated
                        showAuthDialog = false
                    }
                } else {
                    authStatus = .error(response.message)
                    errorMessage = response.message
                }
            } else {
                authStatus = .error("无法连接到服务器")
                errorMessage = "无法连接到服务器"
            }
            
        } catch {
            authStatus = .error(error.localizedDescription)
            errorMessage = error.localizedDescription
        }
    }
    
    private func handleGoogleLogin() async {
        // 与服务器端通信，启动 Google 登录流程
        let apiService = APIService()
        
        if let response = await apiService.startGoogleLogin() {
            if response.success {
                authStatus = .authenticated
                showAuthDialog = false
            } else {
                authStatus = .error(response.message)
                errorMessage = response.message
            }
        } else {
            authStatus = .error("Google 登录失败，请检查网络连接")
            errorMessage = "Google 登录失败，请检查网络连接"
        }
    }
    
    // MARK: - 公共方法
    
    func openAuthDialog() {
        showAuthDialog = true
    }
    
    func closeAuthDialog() {
        showAuthDialog = false
    }
    
    func isAuthenticated() -> Bool {
        if case .authenticated = authStatus {
            return true
        }
        return false
    }
} 