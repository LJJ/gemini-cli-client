# Gemini CLI 项目文档

本文件夹包含 Gemini CLI 项目的所有相关文档，记录了项目开发过程中的重要决策、技术分析和实施计划。

## 文档索引

### 核心项目文档

| 文档 | 描述 | 最后更新 |
|------|------|----------|
| [SWIFTUI_PLAN.md](./SWIFTUI_PLAN.md) | SwiftUI macOS 原生前端开发计划 | 2024-07-04 |
| [PROJECT_TRACKING.md](./PROJECT_TRACKING.md) | 项目进度跟踪和里程碑 | 2024-07-04 |
| [PROJECT_LOG.md](./PROJECT_LOG.md) | 项目开发日志和决策记录 | 2024-07-04 |

### 技术分析文档

| 文档 | 描述 | 最后更新 |
|------|------|----------|
| [TECHNICAL_GUIDE.md](./TECHNICAL_GUIDE.md) | Swift 和 JavaScript/Node.js 技术对比指南 | 2024-07-04 |
| [SANDBOX_ANALYSIS.md](./SANDBOX_ANALYSIS.md) | Gemini CLI 沙盒机制详细分析 | 2024-07-04 |
| [PODMAN_NETWORK_FLOW.md](./PODMAN_NETWORK_FLOW.md) | Podman 沙盒网络请求流程分析 | 2024-07-04 |
| [Podman_Guide.md](./Podman_Guide.md) | Podman 沙盒网络排查实战记录 | 2024-07-04 |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | 综合故障排除指南 | 2024-07-04 |
| [SANDBOX_SECURITY.md](./SANDBOX_SECURITY.md) | 沙盒安全保护详解 | 2024-07-04 |

## 文档分类

### 🚀 开发计划
- **SWIFTUI_PLAN.md**: 详细的四阶段开发计划，包括后端改造、SwiftUI 应用创建、前后端集成和优化
- **PROJECT_TRACKING.md**: 项目里程碑跟踪，包含各阶段的具体任务和时间安排

### 📝 项目管理
- **PROJECT_LOG.md**: 开发过程中的重要决策、问题和解决方案记录

### 🔧 技术文档
- **TECHNICAL_GUIDE.md**: 为 Swift 开发者提供的 JavaScript/Node.js 技术解释
- **SANDBOX_ANALYSIS.md**: 沙盒机制的技术深度分析
- **PODMAN_NETWORK_FLOW.md**: 容器化沙盒的网络请求流程详解
- **Podman_Guide.md**: Podman 沙盒网络问题的实战排查记录
- **SANDBOX_SECURITY.md**: 沙盒安全保护机制详解

## 文档更新规范

1. **新增文档**: 在 `docs/project-docs/` 目录下创建
2. **文档命名**: 使用大写字母和下划线，如 `DOCUMENT_NAME.md`
3. **更新索引**: 在本文档中添加新文档的条目
4. **版本控制**: 所有文档变更通过 Git 进行版本控制

## 快速导航

### 如果您是 Swift 开发者
- 首先阅读 [TECHNICAL_GUIDE.md](./TECHNICAL_GUIDE.md) 了解技术栈差异
- 然后查看 [SWIFTUI_PLAN.md](./SWIFTUI_PLAN.md) 了解开发计划

### 如果您想了解沙盒机制
- 阅读 [SANDBOX_ANALYSIS.md](./SANDBOX_ANALYSIS.md) 了解整体架构
- 查看 [PODMAN_NETWORK_FLOW.md](./PODMAN_NETWORK_FLOW.md) 了解网络流程

### 如果您想跟踪项目进度
- 查看 [PROJECT_TRACKING.md](./PROJECT_TRACKING.md) 了解当前状态
- 阅读 [PROJECT_LOG.md](./PROJECT_LOG.md) 了解历史决策

## 贡献指南

1. 在创建新文档前，请先检查是否已有相关内容
2. 文档应包含清晰的标题、目录和更新日期
3. 技术文档应包含代码示例和实际测试结果
4. 所有文档变更应通过 Pull Request 进行审查

---

*最后更新: 2024-07-04* 