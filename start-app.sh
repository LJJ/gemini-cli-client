#!/bin/bash

# Gemini CLI SwiftUI 应用启动脚本
echo "🚀 启动 Gemini CLI SwiftUI 应用..."

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查是否在正确的目录
if [ ! -f "packages/core/package.json" ]; then
    echo "❌ 错误: 请在 gemini-cli 项目根目录下运行此脚本"
    exit 1
fi

# 启动后端服务器
echo "📡 启动后端 API 服务器..."
cd packages/core
npm run start:server &
SERVER_PID=$!

# 等待服务器启动
echo "⏳ 等待服务器启动..."
sleep 3

# 检查服务器是否启动成功
if curl -s http://localhost:8080/status > /dev/null; then
    echo "✅ 后端服务器启动成功"
else
    echo "❌ 后端服务器启动失败"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# 打开 macOS 应用
echo "🖥️  打开 macOS 应用..."
if [ -d "GeminiForMac" ]; then
    open GeminiForMac/GeminiForMac.xcodeproj
    echo "✅ Xcode 项目已打开，请按 Cmd+R 运行应用"
else
    echo "⚠️  未找到 GeminiForMac 项目，请手动打开 Xcode 项目"
fi

echo ""
echo "🎉 启动完成！"
echo "📱 后端服务器运行在: http://localhost:8080"
echo "🖥️  macOS 应用项目已打开"
echo ""
echo "按 Ctrl+C 停止服务器"

# 清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止服务器..."
    kill $SERVER_PID 2>/dev/null
    echo "✅ 服务器已停止"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 保持脚本运行
wait 