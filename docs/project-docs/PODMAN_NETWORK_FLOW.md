# Podman + Permissive-Open 网络请求流程分析

## 配置说明

当您使用 `GEMINI_SANDBOX=podman` 时，**permissive-open 配置文件实际上不会被使用**。这是因为：

1. **permissive-open 是 macOS Seatbelt 的配置文件**
2. **Podman 使用容器化沙盒，不使用 macOS Seatbelt**
3. **容器化沙盒有自己的网络隔离机制**

## 实际网络请求流程

### 1. 沙盒启动阶段

```typescript
// packages/cli/src/utils/sandbox.ts
export async function start_sandbox(config: SandboxConfig, nodeArgs: string[] = []) {
  if (config.command === 'sandbox-exec') {
    // macOS Seatbelt 路径 - 使用 permissive-open.sb
    const profile = process.env.SEATBELT_PROFILE ??= 'permissive-open';
    // ...
  } else {
    // 容器化沙盒路径 - Podman/Docker
    // 不使用 permissive-open.sb 配置文件
    const args = [
      'run', '-i', '--rm', '--init',
      '--workdir', containerWorkdir,
      '--volume', `${workdir}:${containerWorkdir}`,
      // ... 其他参数
    ];
  }
}
```

### 2. 网络配置分析

#### 无代理情况下的网络流程

```typescript
// 当没有设置 GEMINI_SANDBOX_PROXY_COMMAND 时
if (!proxyCommand) {
  // 容器直接连接到主机网络
  // 网络请求流程：
  // 1. gemini-cli 容器内进程
  // 2. → 容器网络栈
  // 3. → 主机网络栈
  // 4. → 互联网
}
```

#### 有代理情况下的网络流程

```typescript
// 当设置了 GEMINI_SANDBOX_PROXY_COMMAND 时
if (proxyCommand) {
  // 创建内部网络
  execSync(`${config.command} network create --internal ${SANDBOX_NETWORK_NAME}`);
  args.push('--network', SANDBOX_NETWORK_NAME);
  
  // 设置代理环境变量
  args.push('--env', `HTTPS_PROXY=${proxy}`);
  args.push('--env', `HTTP_PROXY=${proxy}`);
  
  // 网络请求流程：
  // 1. gemini-cli 容器内进程
  // 2. → 内部网络 (SANDBOX_NETWORK_NAME)
  // 3. → 代理容器 (SANDBOX_PROXY_NAME)
  // 4. → 主机网络栈
  // 5. → 互联网
}
```

## 详细的网络请求过程

### 场景 1: 无代理配置

```bash
# 启动命令
export GEMINI_SANDBOX=podman
gemini -p "Hello, how are you?"
```

**网络请求流程**:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   gemini-cli    │    │   Podman        │    │   Host          │
│   Container     │    │   Network       │    │   Network       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. HTTP Request       │                       │
         │    to googleapis.com  │                       │
         ├───────────────────────┤                       │
         │                       │ 2. Network Forward    │
         │                       ├───────────────────────┤
         │                       │                       │ 3. Internet
         │                       │                       ├─────────────►
         │                       │                       │
         │ 4. HTTP Response      │                       │
         │    from googleapis.com│                       │
         ├───────────────────────┤                       │
         │                       │ 5. Response Forward   │
         │                       ├───────────────────────┤
         │                       │                       │
```

**关键特点**:
- 容器直接连接到主机网络
- 网络请求不受限制
- 可以访问任何外部服务
- 类似在主机上直接运行

### 场景 2: 有代理配置

```bash
# 启动命令
export GEMINI_SANDBOX=podman
export GEMINI_SANDBOX_PROXY_COMMAND=scripts/example-proxy.js
gemini -p "Hello, how are you?"
```

**网络请求流程**:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   gemini-cli    │    │   Internal      │    │   Proxy         │    │   Host          │
│   Container     │    │   Network       │    │   Container     │    │   Network       │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │                       │
         │ 1. HTTP Request       │                       │                       │
         │    to googleapis.com  │                       │                       │
         ├───────────────────────┤                       │                       │
         │                       │ 2. Route to Proxy     │                       │
         │                       ├───────────────────────┤                       │
         │                       │                       │ 3. Proxy Filter      │
         │                       │                       │    & Forward         │
         │                       │                       ├───────────────────────┤
         │                       │                       │                       │ 4. Internet
         │                       │                       │                       ├─────────────►
         │                       │                       │                       │
         │ 7. HTTP Response      │                       │                       │
         │    from googleapis.com│                       │                       │
         ├───────────────────────┤                       │                       │
         │                       │ 6. Response Route     │                       │
         │                       ├───────────────────────┤                       │
         │                       │                       │ 5. Response Forward  │
         │                       │                       ├───────────────────────┤
         │                       │                       │                       │
```

**关键特点**:
- 容器连接到内部网络
- 所有网络请求通过代理
- 代理可以过滤和限制请求
- 更安全的网络隔离

## 网络配置详解

### 1. 容器网络模式

```typescript
// 无代理时的网络配置
const args = [
  'run', '-i', '--rm', '--init',
  // 默认使用 bridge 网络模式
  // 容器可以访问主机网络
];

// 有代理时的网络配置
if (proxyCommand) {
  // 创建内部网络
  execSync(`${config.command} network create --internal ${SANDBOX_NETWORK_NAME}`);
  args.push('--network', SANDBOX_NETWORK_NAME);
  
  // 创建代理网络
  execSync(`${config.command} network create ${SANDBOX_PROXY_NAME}`);
}
```

### 2. 代理环境变量

```typescript
// 设置代理环境变量
if (proxyCommand) {
  let proxy = process.env.HTTPS_PROXY || 
              process.env.https_proxy || 
              process.env.HTTP_PROXY || 
              process.env.http_proxy || 
              'http://localhost:8877';
  
  // 替换 localhost 为容器名
  proxy = proxy.replace('localhost', SANDBOX_PROXY_NAME);
  
  args.push('--env', `HTTPS_PROXY=${proxy}`);
  args.push('--env', `https_proxy=${proxy}`);
  args.push('--env', `HTTP_PROXY=${proxy}`);
  args.push('--env', `http_proxy=${proxy}`);
}
```

### 3. 代理容器启动

```typescript
// 启动代理容器
const proxyContainerCommand = `${config.command} run --rm --init ${userFlag} --name ${SANDBOX_PROXY_NAME} --network ${SANDBOX_PROXY_NAME} -p 8877:8877 -v ${process.cwd()}:${workdir} --workdir ${workdir} ${image} ${proxyCommand}`;

proxyProcess = spawn(proxyContainerCommand, {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
  detached: true,
});

// 连接代理容器到沙盒网络
await execAsync(`${config.command} network connect ${SANDBOX_NETWORK_NAME} ${SANDBOX_PROXY_NAME}`);
```

## 实际网络请求示例

### 示例 1: 调用 Gemini API

```typescript
// gemini-cli 容器内的请求
const response = await fetch('https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify(requestBody)
});
```

**无代理流程**:
1. 容器内 Node.js 进程发起 HTTP 请求
2. 请求通过容器网络栈
3. 转发到主机网络栈
4. 通过主机网络接口发送到互联网
5. 响应按相反路径返回

**有代理流程**:
1. 容器内 Node.js 进程发起 HTTP 请求
2. 请求被代理环境变量拦截
3. 转发到代理容器 (SANDBOX_PROXY_NAME:8877)
4. 代理容器过滤请求
5. 允许的请求转发到主机网络
6. 响应按相反路径返回

### 示例 2: 文件下载

```typescript
// 下载文件
const response = await fetch('https://example.com/file.txt');
const fileContent = await response.text();
```

**网络流程**:
- 无代理: 直接访问
- 有代理: 通过代理过滤 (只允许特定域名)

## 网络隔离级别对比

| 配置 | 网络隔离 | 安全性 | 灵活性 |
|------|----------|--------|--------|
| 无沙盒 | 无隔离 | 低 | 高 |
| Podman 无代理 | 进程隔离 | 中 | 高 |
| Podman 有代理 | 网络隔离 | 高 | 中 |
| macOS Seatbelt | 系统级隔离 | 高 | 中 |

## 故障排除

### 常见网络问题

1. **连接被拒绝**:
   ```bash
   # 检查容器网络
   podman network ls
   podman network inspect gemini-cli-sandbox
   ```

2. **代理连接失败**:
   ```bash
   # 检查代理容器
   podman ps | grep gemini-cli-sandbox-proxy
   podman logs gemini-cli-sandbox-proxy
   ```

3. **DNS 解析问题**:
   ```bash
   # 在容器内测试
   gemini -s -p "nslookup googleapis.com"
   ```

### 调试网络

```bash
# 启用调试模式
DEBUG=1 gemini -s

# 检查网络配置
gemini -s -p "env | grep -i proxy"
gemini -s -p "curl -v https://googleapis.com"
```

## 总结

当您使用 `GEMINI_SANDBOX=podman` 时：

1. **permissive-open 配置文件不会被使用**
2. **网络请求直接通过容器网络栈**
3. **可以设置代理来增加网络安全性**
4. **网络隔离级别取决于是否使用代理**

这种设计提供了灵活性和安全性的平衡，用户可以根据需要选择是否启用代理来增加网络安全性。 