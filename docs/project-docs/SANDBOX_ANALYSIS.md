# Gemini CLI 沙盒机制深度分析

## 概述

Gemini CLI 的沙盒机制是一个多层次的安全隔离系统，旨在保护用户系统免受 AI 执行的不安全操作影响。它提供了三种不同的沙盒实现方式，每种都有不同的安全级别和适用场景。

## 沙盒类型

### 1. macOS Seatbelt (macOS 专用)

**技术原理**: 使用 macOS 内置的 `sandbox-exec` 工具，基于 Apple 的 Seatbelt 安全框架。

**特点**:
- 轻量级，无需额外软件
- 基于系统级安全策略
- 支持多种预定义配置文件

**配置文件类型**:
```
permissive-open    - 默认配置，限制写入但允许网络
permissive-closed  - 限制写入，无网络访问
permissive-proxied - 限制写入，通过代理访问网络
restrictive-open   - 严格限制，允许网络
restrictive-closed - 最严格限制，无网络
restrictive-proxied - 严格限制，通过代理访问网络
```

**配置文件示例** (`sandbox-macos-permissive-open.sb`):
```lisp
(version 1)
;; allow everything by default
(allow default)

;; deny all writes EXCEPT under specific paths
(deny file-write*)
(allow file-write*
    (subpath (param "TARGET_DIR"))
    (subpath (param "TMP_DIR"))
    (subpath (param "CACHE_DIR"))
    ;; ... 其他允许的路径
)

;; allow all outbound network traffic
(allow network-outbound)
```

### 2. 容器化沙盒 (Docker/Podman)

**技术原理**: 使用容器技术提供完整的进程隔离。

**特点**:
- 跨平台支持
- 完整的进程隔离
- 可自定义容器镜像
- 支持网络代理

**容器镜像构建**:
```dockerfile
FROM docker.io/library/node:20-slim

# 安装必要的工具
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ curl git ripgrep procps \
  && apt-get clean

# 安装 gemini-cli
COPY packages/cli/dist/google-gemini-cli-*.tgz /usr/local/share/npm-global/
RUN npm install -g /usr/local/share/npm-global/gemini-cli.tgz

USER node
CMD ["gemini"]
```

## 沙盒启动流程

### 1. 沙盒命令检测

```typescript
// packages/cli/src/config/sandboxConfig.ts
function getSandboxCommand(sandbox?: boolean | string): SandboxConfig['command'] | '' {
  // 检查是否已在沙盒内
  if (process.env.SANDBOX) {
    return '';
  }

  // 环境变量优先级最高
  const environmentConfiguredSandbox = process.env.GEMINI_SANDBOX?.toLowerCase().trim() ?? '';
  
  // 检测可用命令
  if (os.platform() === 'darwin' && commandExists.sync('sandbox-exec')) {
    return 'sandbox-exec';
  } else if (commandExists.sync('docker') && sandbox === true) {
    return 'docker';
  } else if (commandExists.sync('podman') && sandbox === true) {
    return 'podman';
  }
}
```

### 2. 沙盒启动过程

```typescript
// packages/cli/src/utils/sandbox.ts
export async function start_sandbox(config: SandboxConfig, nodeArgs: string[] = []) {
  if (config.command === 'sandbox-exec') {
    // macOS Seatbelt 启动
    const profile = process.env.SEATBELT_PROFILE ??= 'permissive-open';
    const args = [
      '-D', `TARGET_DIR=${fs.realpathSync(process.cwd())}`,
      '-D', `TMP_DIR=${fs.realpathSync(os.tmpdir())}`,
      '-f', profileFile,
      'sh', '-c', command
    ];
    sandboxProcess = spawn('sandbox-exec', args, { stdio: 'inherit' });
  } else {
    // 容器化沙盒启动
    const args = [
      'run', '--rm', '--init',
      '--volume', `${workdir}:${containerWorkdir}`,
      '--workdir', containerWorkdir,
      '--name', containerName,
      image
    ];
    sandboxProcess = spawn(config.command, args, { stdio: 'inherit' });
  }
}
```

## 安全隔离机制

### 1. 文件系统隔离

**允许的路径**:
- 项目目录 (`TARGET_DIR`)
- 临时目录 (`TMP_DIR`)
- 缓存目录 (`CACHE_DIR`)
- 用户配置目录 (`~/.gemini`, `~/.npm`)

**限制**:
- 禁止写入系统关键目录
- 禁止访问其他用户文件
- 容器内文件权限映射

### 2. 网络隔离

**网络策略**:
```typescript
// 代理网络配置
if (proxyCommand) {
  // 创建内部网络
  execSync(`${config.command} network create --internal ${SANDBOX_NETWORK_NAME}`);
  args.push('--network', SANDBOX_NETWORK_NAME);
  
  // 设置代理环境变量
  args.push('--env', `HTTPS_PROXY=${proxy}`);
  args.push('--env', `HTTP_PROXY=${proxy}`);
}
```

**代理机制**:
- 自定义代理服务器 (`GEMINI_SANDBOX_PROXY_COMMAND`)
- 代理监听端口 8877
- 支持 HTTPS 连接过滤

### 3. 进程隔离

**用户权限处理**:
```typescript
// Linux UID/GID 映射
if (await shouldUseCurrentUserInSandbox()) {
  const uid = execSync('id -u').toString().trim();
  const gid = execSync('id -g').toString().trim();
  
  // 在容器内创建对应用户
  const setupUserCommands = [
    `groupadd -f -g ${gid} ${username}`,
    `useradd -o -u ${uid} -g ${gid} -d ${homeDir} -s /bin/bash ${username}`
  ];
}
```

## 沙盒配置选项

### 环境变量配置

```bash
# 启用沙盒
export GEMINI_SANDBOX=true
export GEMINI_SANDBOX=docker
export GEMINI_SANDBOX=podman

# 自定义镜像
export GEMINI_SANDBOX_IMAGE=my-custom-sandbox

# 网络代理
export GEMINI_SANDBOX_PROXY_COMMAND=scripts/my-proxy.js

# 挂载点
export SANDBOX_MOUNTS=/path/to/mount:/container/path:ro

# 端口暴露
export SANDBOX_PORTS=3000,8080

# 环境变量传递
export SANDBOX_ENV=KEY1=value1,KEY2=value2
```

### 项目级自定义

**自定义 Dockerfile** (`.gemini/sandbox.Dockerfile`):
```dockerfile
FROM gemini-cli-sandbox

# 添加项目特定依赖
RUN apt-get update && apt-get install -y my-package

# 复制项目配置
COPY ./my-config /app/my-config
```

**自定义启动脚本** (`.gemini/sandbox.bashrc`):
```bash
# 设置项目特定环境
export PROJECT_ENV=development

# 安装项目依赖
npm install

# 启动服务
npm start &
```

## 网络代理机制

### 代理服务器实现

```javascript
// scripts/example-proxy.js
const server = http.createServer((req, res) => {
  // 只允许 CONNECT 请求 (HTTPS)
  if (req.method !== 'CONNECT') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }
});

server.on('connect', (req, clientSocket, head) => {
  const { port, hostname } = new URL(`http://${req.url}`);
  
  // 检查允许的域名
  if (ALLOWED_DOMAINS.some(domain => hostname.endsWith(`.${domain}`))) {
    // 建立隧道连接
    const serverSocket = net.connect(port, hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });
  }
});
```

### 网络隔离策略

1. **内部网络**: 沙盒容器连接到内部网络
2. **代理容器**: 代理服务运行在独立容器中
3. **网络桥接**: 代理容器连接主机网络和内部网络
4. **流量过滤**: 只允许特定域名的 HTTPS 连接

## 安全考虑

### 1. 权限最小化

- 使用非 root 用户运行
- 限制文件系统访问
- 控制网络访问

### 2. 资源限制

- 容器资源限制 (CPU, 内存)
- 进程数量限制
- 文件描述符限制

### 3. 审计和监控

- 操作日志记录
- 网络连接监控
- 文件访问审计

## 性能优化

### 1. 镜像优化

- 使用 slim 基础镜像
- 多阶段构建
- 清理不必要的包

### 2. 启动优化

- 镜像预构建
- 缓存层复用
- 并行构建

### 3. 运行时优化

- 卷挂载优化
- 网络配置优化
- 内存使用优化

## 故障排除

### 常见问题

1. **权限问题**:
   ```bash
   # 检查用户权限
   id -u && id -g
   
   # 设置 UID/GID 映射
   export SANDBOX_SET_UID_GID=true
   ```

2. **网络问题**:
   ```bash
   # 检查网络连接
   curl -v https://googleapis.com
   
   # 配置代理
   export GEMINI_SANDBOX_PROXY_COMMAND=scripts/example-proxy.js
   ```

3. **文件访问问题**:
   ```bash
   # 检查挂载点
   mount | grep workspace
   
   # 添加自定义挂载
   export SANDBOX_MOUNTS=/path/to/mount:/container/path:rw
   ```

### 调试模式

```bash
# 启用调试
DEBUG=1 gemini -s

# 检查沙盒环境
gemini -s -p "env | grep SANDBOX"
gemini -s -p "mount | grep workspace"
```

## 总结

Gemini CLI 的沙盒机制提供了多层次的安全保护：

1. **平台适配**: 针对不同平台提供最适合的沙盒方案
2. **安全隔离**: 文件系统、网络、进程的全面隔离
3. **灵活配置**: 支持自定义配置和扩展
4. **性能优化**: 平衡安全性和性能需求
5. **易于使用**: 简化的配置和启动流程

这种设计确保了 AI 工具在提供强大功能的同时，不会对用户系统造成安全风险。 