# Gemini CLI 代理设置指南

## 问题描述

在 Podman 沙盒环境中，硬编码的代理配置会导致网络连接问题：
```
[API Error: request to https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse failed, reason: connect ECONNREFUSED 192.168.127.254:7890]
```

## 问题原因

1. **硬编码代理**: 在 `node_modules/@google/gemini-cli/dist/index.js` 中硬编码了 `127.0.0.1:7890`
2. **网络地址转换**: Podman 沙盒将 `127.0.0.1` 映射为 `192.168.127.254`
3. **代理不可达**: 沙盒内的进程无法访问宿主机上的代理服务

## 解决方案

### 方案 1: 移除硬编码代理（推荐）

已执行的操作：
```bash
# 备份原文件
cp node_modules/@google/gemini-cli/dist/index.js node_modules/@google/gemini-cli/dist/index.js.backup

# 移除硬编码代理配置
# 删除了以下代码：
# import { setGlobalDispatcher, ProxyAgent } from "undici";
# const dispatcher = new ProxyAgent({ uri: new URL('http://127.0.0.1:7890').toString() });
# setGlobalDispatcher(dispatcher);
```

### 方案 2: 使用环境变量设置代理

如果需要使用代理，请使用环境变量：

```bash
# 设置代理环境变量
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890

# 或者使用小写
export https_proxy=http://127.0.0.1:7890
export http_proxy=http://127.0.0.1:7890

# 启动 gemini-cli
gemini
```

### 方案 3: 使用 gemini-cli 内置的代理功能

gemini-cli 支持通过配置设置代理：

```bash
# 在项目根目录创建 .env 文件
echo "HTTPS_PROXY=http://127.0.0.1:7890" > .env
echo "HTTP_PROXY=http://127.0.0.1:7890" >> .env

# 启动 gemini-cli
gemini
```

### 方案 4: 在沙盒环境中使用代理

如果必须在沙盒环境中使用代理，可以：

1. **使用 gemini-cli 的代理功能**:
   ```bash
   # 设置代理命令
   export GEMINI_SANDBOX_PROXY_COMMAND=scripts/example-proxy.js
   
   # 启动 gemini-cli
   gemini
   ```

2. **修改代理脚本**:
   编辑 `scripts/example-proxy.js` 来支持您的代理需求

## 验证修复

修复后，gemini-cli 应该能够：
1. 正常连接到 Google API
2. 不再出现 `192.168.127.254:7890` 错误
3. 在沙盒环境中正常工作

## 注意事项

1. **不要修改 node_modules**: 修改 `node_modules` 中的文件不是好的实践
2. **使用环境变量**: 优先使用环境变量来配置代理
3. **沙盒兼容性**: 在沙盒环境中，网络配置需要特殊处理
4. **备份重要**: 修改前总是备份原始文件

## 恢复备份

如果需要恢复原始配置：
```bash
cp node_modules/@google/gemini-cli/dist/index.js.backup node_modules/@google/gemini-cli/dist/index.js
``` 