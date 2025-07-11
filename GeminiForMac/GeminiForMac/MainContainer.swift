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
}
