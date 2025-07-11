//
//  AuthDialogView.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/9.
//

import SwiftUI
import Factory

struct AuthDialogView: View {
    @StateObject private var authService = Container.shared.authService.resolve()
    @State private var selectedAuthType: AuthType = .loginWithGoogle
    @State private var apiKey = ""
    @State private var googleCloudProject = ""
    @State private var googleCloudLocation = ""
    @State private var validationError: String?
    
    var body: some View {
        VStack(spacing: 20) {
            // 标题
            HStack {
                Image(systemName: "person.circle.fill")
                    .foregroundColor(.blue)
                    .font(.title)
                Text("选择认证方式")
                    .font(.title2)
                    .fontWeight(.semibold)
                Spacer()
            }
            
            // 认证方式选择
            VStack(alignment: .leading, spacing: 12) {
                Text("认证方式")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                ForEach(AuthType.allCases, id: \.self) { authType in
                    AuthTypeRow(
                        authType: authType,
                        isSelected: selectedAuthType == authType,
                        onSelect: {
                            selectedAuthType = authType
                            validationError = nil
                        }
                    )
                }
            }
            
            // 认证配置表单
            if selectedAuthType == .useGemini {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Gemini API Key")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    SecureField("输入你的 Gemini API Key", text: $apiKey)
                        .textFieldStyle(.roundedBorder)
                    
                    Text("从 [AI Studio](https://aistudio.google.com/) 获取 API Key")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else if selectedAuthType == .useVertexAI {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Google API Key")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        SecureField("输入你的 Google API Key", text: $apiKey)
                            .textFieldStyle(.roundedBorder)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Google Cloud Project ID")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        TextField("输入你的 Google Cloud Project ID", text: $googleCloudProject)
                            .textFieldStyle(.roundedBorder)
                    }
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Google Cloud Location")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        TextField("例如: us-central1", text: $googleCloudLocation)
                            .textFieldStyle(.roundedBorder)
                    }
                }
            }
            
            // 错误信息
            if let error = validationError {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.red.opacity(0.1))
                .cornerRadius(8)
            }
            
            // 认证状态
            if case .authenticating = authService.authStatus {
                HStack {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("正在认证...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
            }
            
            // 按钮
            HStack(spacing: 12) {
                Button("取消") {
                    authService.closeAuthDialog()
                }
                .buttonStyle(.bordered)
                
                Spacer()
                
                Button("确认") {
                    Task {
                        await authenticate()
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(authService.authStatus == .authenticating)
            }
        }
        .padding(24)
        .frame(maxWidth: 500)
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(12)
        .shadow(radius: 10)
    }
    
    private func authenticate() async {
        // 验证输入
        let error = authService.validateAuthMethod(
            selectedAuthType,
            apiKey: apiKey.isEmpty ? nil : apiKey,
            googleCloudProject: googleCloudProject.isEmpty ? nil : googleCloudProject,
            googleCloudLocation: googleCloudLocation.isEmpty ? nil : googleCloudLocation
        )
        
        if let error = error {
            validationError = error
            return
        }
        
        validationError = nil
        
        // 执行认证
        await authService.authenticate(
            authType: selectedAuthType,
            apiKey: apiKey.isEmpty ? nil : apiKey,
            googleCloudProject: googleCloudProject.isEmpty ? nil : googleCloudProject,
            googleCloudLocation: googleCloudLocation.isEmpty ? nil : googleCloudLocation
        )
    }
}

struct AuthTypeRow: View {
    let authType: AuthType
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack {
                // 选择指示器
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .blue : .secondary)
                    .font(.title3)
                
                // 认证方式信息
                VStack(alignment: .leading, spacing: 4) {
                    Text(authType.displayName)
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                    
                    Text(authType.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.leading)
                }
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.blue : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    AuthDialogView()
        .padding()
} 
