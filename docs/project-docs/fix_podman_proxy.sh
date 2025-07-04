#!/bin/bash

# Podman 沙盒代理问题快速修复脚本
# 解决 gemini-cli 在 Podman 沙盒中的代理连接问题

echo "🔧 修复 Podman 沙盒代理问题..."

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "❌ 请在 gemini-cli 项目根目录运行此脚本"
    exit 1
fi

# 检查代理是否运行
echo "📡 检查代理服务状态..."
if ! lsof -i :7890 > /dev/null 2>&1; then
    echo "⚠️  警告: 端口 7890 没有监听，请确保代理服务正在运行"
    echo "   例如: clash, v2ray, 或其他代理工具"
fi

# 获取宿主机 IP
HOST_IP="192.168.127.254"
echo "🌐 使用宿主机 IP: $HOST_IP"

# 创建 .env 文件
echo "📝 创建 .env 文件..."
cat > .env << EOF
# Podman 沙盒代理配置
SANDBOX_ENV=HTTPS_PROXY=http://$HOST_IP:7890,HTTP_PROXY=http://$HOST_IP:7890,https_proxy=http://$HOST_IP:7890,http_proxy=http://$HOST_IP:7890

# 可选: 设置 NO_PROXY 来绕过本地地址
# SANDBOX_ENV=\$SANDBOX_ENV,NO_PROXY=localhost,127.0.0.1,192.168.127.0/24
EOF

echo "✅ .env 文件已创建"

# 测试网络连通性
echo "🧪 测试网络连通性..."
if command -v podman > /dev/null; then
    echo "   测试 Podman VM 到宿主机代理的连接..."
    if podman machine ssh -- curl -x http://$HOST_IP:7890 -s https://google.com > /dev/null 2>&1; then
        echo "   ✅ Podman VM 可以连接到宿主机代理"
    else
        echo "   ❌ Podman VM 无法连接到宿主机代理"
        echo "   请检查代理服务是否正在运行"
    fi
else
    echo "   ⚠️  Podman 未安装，跳过网络测试"
fi

echo ""
echo "🎯 修复完成！现在可以尝试运行:"
echo "   gemini -s -p 'Hello, how are you?'"
echo ""
echo "📋 如果仍有问题，请检查:"
echo "   1. 代理服务是否在端口 7890 运行"
echo "   2. 防火墙是否允许连接"
echo "   3. 使用 'podman machine ssh' 进入 VM 测试网络"
echo ""
echo "🔍 调试命令:"
echo "   # 查看容器环境变量"
echo "   podman exec -it <container_id> env | grep -i proxy"
echo ""
echo "   # 在容器内测试网络"
echo "   podman exec -it <container_id> curl -v https://google.com" 