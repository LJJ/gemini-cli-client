#!/bin/bash

echo "🛑 停止现有服务器..."
pkill -f "node.*server" || true

echo "🔨 重新编译 core 包..."
npm run build:core

echo "🚀 启动服务器..."
npm run start 