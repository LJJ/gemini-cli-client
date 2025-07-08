#!/bin/bash

# 设置代理（请根据你的代理端口修改）
export http_proxy=http://127.0.0.1:7890
export https_proxy=http://127.0.0.1:7890

# Gemini CLI SwiftUI 应用启动脚本
echo "🚀 启动 Gemini CLI SwiftUI 应用..."

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 设置项目路径
PROJECT_PATH="$HOME/workplace/AI/gemini-cli"

# 检查项目是否存在
if [ ! -d "$PROJECT_PATH" ]; then
    echo "❌ 错误: 未找到 gemini-cli 项目，请检查路径: $PROJECT_PATH"
    exit 1
fi

# 检查项目结构
if [ ! -f "$PROJECT_PATH/packages/core/package.json" ]; then
    echo "❌ 错误: 项目结构不正确，请检查: $PROJECT_PATH"
    exit 1
fi

# 切换到项目目录
echo "📁 切换到项目目录: $PROJECT_PATH"
cd "$PROJECT_PATH"

# 启动后端服务器
echo "📡 启动后端 API 服务器..."
cd packages/core

# 设置工作目录为用户主目录，这样 Gemini 可以访问所有用户文件
export GEMINI_WORKSPACE="$HOME"
echo "🏠 设置工作目录为: $GEMINI_WORKSPACE"

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
if [ -d "$PROJECT_PATH/GeminiForMac" ]; then
    open "$PROJECT_PATH/GeminiForMac/GeminiForMac.xcodeproj"
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