# Podman 沙盒网络排查流程（实战记录）

本文记录了一次使用 `gemini-cli` 启动 Podman 沙盒容器时出现代理网络错误的排查过程，方便日后回顾和熟悉 Podman 沙盒容器的工作方式。

---

## ❓ 问题背景

运行 `gemini-cli` 时，命令失败并报错：

```
[API Error: request to https://cloudcode-pa.googleapis.com/... failed, reason: connect ECONNREFUSED 192.168.127.254:7890]
```

该错误提示表明容器内试图通过代理 `192.168.127.254:7890` 访问外部网络失败，被拒绝连接。

---

## ✅ 网络连通性初步确认

### 1. 进入 Podman 虚拟机

```bash
podman machine ssh
```

### 2. 测试是否能访问宿主机代理端口

```bash
curl -x http://192.168.127.254:7890 https://google.com
```

返回正常 HTML，说明 Podman VM ➜ 宿主机代理连接 ✅ 正常。

---

## ✅ 进一步确认容器内部网络状态

### 1. 查看当前正在运行的容器

```bash
podman ps
```

找到 gemini 的沙盒容器 ID，例如：

```
CONTAINER ID  IMAGE               STATUS         NAMES
abc12345...   gemini-cli-sandbox  Up 3 minutes   gemini-cli-sandbox
```

### 2. 进入容器内部

```bash
podman exec -it abc12345 bash
```

### 3. 查看代理环境变量

```bash
env | grep -i proxy
```

发现默认代理为：

```
HTTPS_PROXY=http://host.containers.internal:7890
```

虽然有时候这个域名在 curl 中解析没问题，但在 Node.js 中通过 `undici` 发起请求时存在 DNS 问题，表现为 `ECONNREFUSED`。

---

## ✅ 解决方案：显式使用 IP 注入代理

我们将 `host.containers.internal` 替换为明确的宿主机 IP `192.168.127.254`：

```bash
export SANDBOX_ENV="HTTPS_PROXY=http://192.168.127.254:7890,HTTP_PROXY=http://192.168.127.254:7890"
```

或写入 `.env` 文件：

```ini
SANDBOX_ENV=HTTPS_PROXY=http://192.168.127.254:7890,HTTP_PROXY=http://192.168.127.254:7890
```

这样 Podman 沙盒容器中环境变量就会显式传入正确的代理地址。

---

## ✅ 验证成功

重新运行：

```bash
npm run build:all
gemini run "print('proxy ok')"
```

输出正常，网络请求成功返回，说明问题已解决。

---

## 🧠 总结

| 检查点 | 工具或命令 |
|--------|-------------|
| 宿主机是否监听 7890 | `lsof -i :7890` |
| VM 是否能连上代理 | `curl -x ...` in `podman machine ssh` |
| 容器是否配置了正确代理 | `env | grep proxy` inside container |
| 修复方法 | 用 `SANDBOX_ENV` 注入明确 IP |

---

## 🔍 深入分析

### 网络拓扑结构

```
宿主机 (192.168.127.254:7890)
    ↑
Podman VM (192.168.127.1)
    ↑
容器 (host.containers.internal:7890)
```

### 问题根源

1. **DNS 解析问题**: `host.containers.internal` 在某些情况下无法正确解析
2. **Node.js undici 库**: 对代理地址的解析方式与 curl 不同
3. **容器网络隔离**: 容器内的网络栈与宿主机存在差异

### 最佳实践

1. **使用明确 IP**: 避免依赖 DNS 解析
2. **环境变量注入**: 通过 `SANDBOX_ENV` 确保代理配置正确传递
3. **网络测试**: 在容器内进行网络连通性测试

---

本次排查过程中熟悉了：

- Podman Machine 和容器之间的网络拓扑
- `host.containers.internal` 与 `192.168.127.254` 的差异
- 如何用 `podman exec` 进入容器调试
- Gemini CLI 沙盒代理注入机制（通过 `SANDBOX_ENV`）

---

*最后更新: 2024-07-04*

# 检查容器内的代理配置
gemini -s -p "env | grep -i proxy"

# 测试网络连接
gemini -s -p "curl -v https://google.com"
