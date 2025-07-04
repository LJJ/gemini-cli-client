# Gemini CLI 故障排除指南

本指南涵盖了使用 Gemini CLI 时可能遇到的常见问题及其解决方案。

---

## 🚨 常见错误及解决方案

### 1. Podman 沙盒代理连接错误

**错误信息**:
```
[API Error: request to https://cloudcode-pa.googleapis.com/... failed, reason: connect ECONNREFUSED 192.168.127.254:7890]
```

**问题原因**:
- 容器内无法正确解析代理地址
- Node.js undici 库对代理地址的解析方式与 curl 不同
- 容器网络栈与宿主机的差异

**解决方案**:

#### 方案 A: 使用修复脚本（推荐）
```bash
# 运行自动修复脚本
./docs/project-docs/fix_podman_proxy.sh
```

#### 方案 B: 手动配置
```bash
# 创建 .env 文件
cat > .env << EOF
SANDBOX_ENV=HTTPS_PROXY=http://192.168.127.254:7890,HTTP_PROXY=http://192.168.127.254:7890
EOF

# 重新运行 gemini
gemini -s -p "Hello, how are you?"
```

#### 方案 C: 环境变量设置
```bash
# 直接设置环境变量
export SANDBOX_ENV="HTTPS_PROXY=http://192.168.127.254:7890,HTTP_PROXY=http://192.168.127.254:7890"
gemini -s -p "Hello, how are you?"
```

### 2. 沙盒构建失败

**错误信息**:
```
ERROR: Sandbox image 'gemini-cli-sandbox' is missing or could not be pulled
```

**解决方案**:
```bash
# 重新构建沙盒镜像
npm run build:sandbox

# 或者构建所有内容
npm run build:all
```

### 3. 权限问题

**错误信息**:
```
ERROR: Operation not permitted
```

**解决方案**:
```bash
# 检查文件权限
ls -la

# 修复权限
chmod +x scripts/*.sh

# 如果使用 Podman，检查用户映射
export SANDBOX_SET_UID_GID=true
```

### 4. 网络连接问题

**错误信息**:
```
ERROR: Network connection failed
```

**解决方案**:
```bash
# 检查网络配置
gemini -s -p "curl -v https://google.com"

# 检查代理设置
gemini -s -p "env | grep -i proxy"

# 测试 DNS 解析
gemini -s -p "nslookup googleapis.com"
```

---

## 🔍 调试技巧

### 1. 启用调试模式
```bash
# 启用详细日志
DEBUG=1 gemini -s

# 启用调试端口
DEBUG=1 DEBUG_PORT=9229 gemini -s
```

### 2. 检查容器状态
```bash
# 查看运行中的容器
podman ps

# 查看容器日志
podman logs <container_id>

# 进入容器调试
podman exec -it <container_id> bash
```

### 3. 网络诊断
```bash
# 测试宿主机到代理的连接
curl -x http://127.0.0.1:7890 https://google.com

# 测试 Podman VM 到代理的连接
podman machine ssh -- curl -x http://192.168.127.254:7890 https://google.com

# 在容器内测试网络
podman exec -it <container_id> curl -v https://google.com
```

### 4. 环境变量检查
```bash
# 检查所有环境变量
gemini -s -p "env | sort"

# 检查代理相关变量
gemini -s -p "env | grep -i proxy"

# 检查网络配置
gemini -s -p "ip route"
```

---

## 🛠️ 高级故障排除

### 1. 清理和重置
```bash
# 清理所有容器
podman rm -f $(podman ps -aq)

# 清理网络
podman network prune -f

# 重新构建
npm run build:all
```

### 2. 自定义沙盒配置
```bash
# 创建自定义沙盒配置
mkdir -p .gemini
cat > .gemini/sandbox.bashrc << EOF
# 自定义环境变量
export CUSTOM_PROXY=http://192.168.127.254:7890
EOF

# 使用自定义配置
BUILD_SANDBOX=1 gemini -s
```

### 3. 代理服务器配置
```bash
# 使用 gemini-cli 内置代理
export GEMINI_SANDBOX_PROXY_COMMAND=scripts/example-proxy.js
gemini -s

# 自定义代理脚本
cat > custom-proxy.js << EOF
#!/usr/bin/env node
// 自定义代理逻辑
EOF
export GEMINI_SANDBOX_PROXY_COMMAND=./custom-proxy.js
```

---

## 📋 检查清单

在报告问题之前，请确认以下项目：

- [ ] 代理服务正在运行（端口 7890）
- [ ] 防火墙允许连接
- [ ] Podman 服务正常运行
- [ ] 网络连接正常
- [ ] 环境变量正确设置
- [ ] 沙盒镜像已构建
- [ ] 权限设置正确

---

## 🆘 获取帮助

如果以上解决方案都无法解决问题：

1. **查看详细日志**: 使用 `DEBUG=1` 获取更多信息
2. **检查系统要求**: 确保满足所有依赖要求
3. **查看项目文档**: 参考 `docs/project-docs/` 中的相关文档
4. **提交 Issue**: 在项目仓库中提交详细的问题报告

---

## 📚 相关文档

- [Podman 指南](./Podman_Guide.md) - Podman 沙盒网络排查实战记录
- [沙盒分析](./SANDBOX_ANALYSIS.md) - 沙盒机制详细分析
- [网络流程](./PODMAN_NETWORK_FLOW.md) - 网络请求流程分析

---

*最后更新: 2024-07-04* 