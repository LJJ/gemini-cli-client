import Foundation

struct ModelInfo {
    let name: String
    let isAvailable: Bool
    let displayName: String

    init(name: String, isAvailable: Bool) {
        self.name = name
        self.isAvailable = isAvailable
        self.displayName = name == "gemini-2.5-pro" ? "Gemini Pro" : "Gemini Flash"
    }
}

// API响应结构
struct ModelStatusResponse: Codable {
    let success: Bool
    let data: ModelStatusData
}

struct ModelStatusData: Codable {
    let currentModel: String
    let supportedModels: [SupportedModel]
}

struct SupportedModel: Codable {
    let name: String
    let isAvailable: Bool
}

struct ModelSwitchResponse: Codable {
    let success: Bool
    let data: ModelSwitchData?
    let message: String?
    let type: String?
}

struct ModelSwitchData: Codable {
    let previousModel: String
    let newModel: String
} 