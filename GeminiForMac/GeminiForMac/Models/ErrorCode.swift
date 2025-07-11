//
//  ErrorCode.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/9.
//

import Foundation

// MARK: - 错误代码枚举
// 与后端 API 规范完全一致

enum ErrorCode: String, Codable, CaseIterable {
    // 验证错误
    case validationError = "VALIDATION_ERROR"
    
    // 认证相关错误
    case authNotSet = "AUTH_NOT_SET"
    case authRequired = "AUTH_REQUIRED"
    case authConfigFailed = "AUTH_CONFIG_FAILED"
    case oauthInitFailed = "OAUTH_INIT_FAILED"
    
    // 客户端初始化错误
    case clientNotInitialized = "CLIENT_NOT_INITIALIZED"
    case clientInitFailed = "CLIENT_INIT_FAILED"
    
    // 流式处理错误
    case streamError = "STREAM_ERROR"
    case turnNotInitialized = "TURN_NOT_INITIALIZED"
    case abortControllerNotInitialized = "ABORT_CONTROLLER_NOT_INITIALIZED"
    
    // Gemini API 错误
    case geminiError = "GEMINI_ERROR"
    
    // 工具相关错误
    case toolSchedulerNotInitialized = "TOOL_SCHEDULER_NOT_INITIALIZED"
    case toolCallNotFound = "TOOL_CALL_NOT_FOUND"
    case toolInvalidOutcome = "TOOL_INVALID_OUTCOME"
    
    // 通用错误
    case internalError = "INTERNAL_ERROR"
    case networkError = "NETWORK_ERROR"
    case unknownError = "UNKNOWN_ERROR"
}

// MARK: - 错误代码描述映射
extension ErrorCode {
    var description: String {
        switch self {
        case .validationError:
            return "请求参数验证失败"
        case .authNotSet:
            return "未设置认证类型"
        case .authRequired:
            return "用户未认证，请先完成认证设置"
        case .authConfigFailed:
            return "认证配置失败"
        case .oauthInitFailed:
            return "OAuth 客户端初始化失败"
        case .clientNotInitialized:
            return "Gemini 客户端未初始化"
        case .clientInitFailed:
            return "Gemini 客户端初始化失败"
        case .streamError:
            return "流式处理错误"
        case .turnNotInitialized:
            return "Turn 或 AbortController 未初始化"
        case .abortControllerNotInitialized:
            return "AbortController 未初始化"
        case .geminiError:
            return "Gemini API 错误"
        case .toolSchedulerNotInitialized:
            return "工具调度器未初始化"
        case .toolCallNotFound:
            return "工具调用未找到或不在等待确认状态"
        case .toolInvalidOutcome:
            return "无效的工具调用结果"
        case .internalError:
            return "服务器内部错误"
        case .networkError:
            return "网络连接错误"
        case .unknownError:
            return "未知错误"
        }
    }
}

// MARK: - 错误处理扩展
extension ErrorCode {
    /// 是否需要用户重新认证
    var requiresReauthentication: Bool {
        switch self {
        case .authRequired, .authNotSet, .authConfigFailed, .oauthInitFailed:
            return true
        default:
            return false
        }
    }
    
    /// 是否需要用户检查网络连接
    var requiresNetworkCheck: Bool {
        switch self {
        case .networkError, .clientInitFailed, .oauthInitFailed:
            return true
        default:
            return false
        }
    }
    
    /// 是否需要用户重试操作
    var requiresRetry: Bool {
        switch self {
        case .streamError, .internalError, .geminiError, .clientInitFailed:
            return true
        default:
            return false
        }
    }
    
    /// 是否需要用户检查输入参数
    var requiresInputValidation: Bool {
        switch self {
        case .validationError, .toolInvalidOutcome:
            return true
        default:
            return false
        }
    }
    
    /// 获取用户友好的错误提示
    var userFriendlyMessage: String {
        switch self {
        case .authRequired:
            return "请先完成认证设置"
        case .authNotSet:
            return "请设置认证方式"
        case .authConfigFailed:
            return "认证配置失败，请检查设置"
        case .oauthInitFailed:
            return "Google 登录失败，请检查网络连接或尝试使用 API Key"
        case .clientNotInitialized:
            return "客户端未初始化，请重试"
        case .clientInitFailed:
            return "客户端初始化失败，请检查网络连接后重试"
        case .streamError:
            return "处理请求时发生错误，请重试"
        case .turnNotInitialized:
            return "对话状态异常，请重新开始对话"
        case .abortControllerNotInitialized:
            return "操作被中断，请重试"
        case .geminiError:
            return "AI 服务暂时不可用，请稍后重试"
        case .toolSchedulerNotInitialized:
            return "工具服务未就绪，请重试"
        case .toolCallNotFound:
            return "工具调用状态异常，请重试"
        case .toolInvalidOutcome:
            return "工具操作参数无效，请检查后重试"
        case .internalError:
            return "服务器内部错误，请稍后重试"
        case .networkError:
            return "网络连接错误，请检查网络后重试"
        case .validationError:
            return "输入参数有误，请检查后重试"
        case .unknownError:
            return "发生未知错误，请重试"
        }
    }
} 