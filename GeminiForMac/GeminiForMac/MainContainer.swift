//
//  MainContainer.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/11.
//

import Foundation
import Factory

extension Container {
    @MainActor
    var authService:Factory<AuthService> {
        self {@MainActor in AuthService()}.shared
    }
    
    @MainActor
    var chatService:Factory<ChatService> {
        self {@MainActor in ChatService()}.shared
    }

    @MainActor
    var fileExplorerService:Factory<FileExplorerService> {
        self {@MainActor in FileExplorerService()}.shared
    }
}
