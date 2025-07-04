//
//  Item.swift
//  GeminiForMac
//
//  Created by LJJ on 2025/7/4.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
