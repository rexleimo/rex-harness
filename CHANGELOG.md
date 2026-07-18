# Changelog

本文件记录 `rex-harness` 独立产品的公开变化。版本遵循 Semantic Versioning。

## [0.4.2] - 2026-07-17

### Added

- 为 `rex-tdd` 增加无 Skill 控制组、10 条训练任务、5 条隔离验证任务、独立逐断言评分和内容哈希 Gate。
- 新增测试范围缩放、Mock/helper 假证据、阶段越权、严格 TDD 自升级、命令/输出证据和实现反推契约等压力场景。
- 接受 `rex-tdd` v7 候选：使用新的正交留出集验证冻结观察包协议，并保留三组隔离 Target/Scorer 的可复核证据。

### Fixed

- 基础 TDD 现在明确要求用户重新确认范围变化，并只在 rex 返回风险支持的新 Command 时切换严格 TDD。
- 测试 Evidence 现在必须保留精确命令、退出状态和观察输出，不能用聊天结论、文件存在或内部调用断言替代用户可观察行为。
- 训练时间线测试不再把 v6 历史证据绑定到后续 v7 的状态或工件，避免接受新版本后误报旧阶段回归。

## [0.4.1] - 2026-07-17

### Added

- 为 standalone 状态损坏、旧 token 重放、非法 Evidence、只读负例、提示长度和宿主提升新增场景测试。
- 为 `rex-workflow` 增加 10 条训练任务、5 条隔离验证任务、无历史原始回答、独立逐断言评分和可复现的两步 SkillOpt Gate 证据。

### Fixed

- 只读和混合变更请求按可执行子句分类；简写否定、复合否定动作列表和子句顺序不再误触发 Capability，也不会吞掉后续修复目标。
- `rex-workflow` 先验证 compact 响应组合；终态矛盾时 fail-closed，且不得猜测、补写或伪造缺失 Evidence。

## [0.4.0] - 2026-07-17

### Added

- 新增 Hermes 与 Grok Build 的原生 Skill 投影，并由 AIOS 集成契约检查客户端注册表一致性。
- 新增 `rex-workflow` 客户端编排 Skill，通过原生 Skill 发现和 Shell 驱动 standalone 工作流。
- 新增 CLI compact Command 协议；`--full` 可显式读取完整 Workflow 诊断对象。

### Changed

- Coding Agent 默认只接收当前 Provider、阶段目标、Evidence Contract 和一次性 token；完整历史继续保存在 `.rex-harness/`。
- 专项 Reviewer Catalog 改为 `rex-workflow` 的按需 reference，随客户端 Skill 投影一起安装。
- AIOS 等宿主继续直接使用完整 JS API，不依赖 CLI 文本协议。

### Removed

- 移除核心 MCP Server、CLI `mcp` 命令、MCP SDK 依赖和公开 MCP exports；未来协议适配应作为独立可选包。

## [0.3.0] - 2026-07-16

### Added

- 新增完整的 rex-native Provider Catalog，覆盖需求、设计、规划、测试设计、基础/严格 TDD、调试、最小构造、实施、代码审查、专项审查和 Wayfinding。
- 新增内置专项 Reviewer Catalog、Provider Doctor，以及 Codex、Claude、Gemini、OpenCode 的无覆盖 Skill 投影安装器。
- 新增独立 MCP stdio server，复用 standalone workflow、Evidence、Doctor 和 Provider 服务。
- 新增测试范围契约；任何行为变更先确认目标、非目标、验收映射和测试缝，再进入基础或严格 TDD。

### Changed

- 默认执行路径改为纯 rex-native；Matt、Superpowers、ECC 和 Ponytail 只在宿主显式 compatibility mode 下替换当前 Provider。
- 将 Capability Pack 移入 `src/kernel/`，使 `src/aios/` 只保留可选宿主 Manifest 投影。
- Doctor 现在会验证每个内置 Provider 的真实说明文件和 Reviewer Catalog，缺失时 fail-closed。
- `implementation-ready` 现在不能绕过测试范围契约，也不会在 TDD GREEN 之后重复调度独立实施。

## [0.2.0] - 2026-07-16

### Added

- 新增不依赖 AIOS 的 `start`、`status`、`evidence` 和 `resume` 命令。
- 新增 `.rex-harness/` 本地 Workflow Activation、Capability 投影和只追加 Evidence Journal。
- 新增完整的自适应软件工作流运行时，由 Fact 选择当前唯一 Capability 和 Provider Command。
- 新增 Command token 轮换、Evidence 类型与引用协议校验、损坏状态 fail-closed 等独立安全约束。

### Changed

- 将 `adaptive-software-delivery` 确立为唯一运行时事实源；静态 Recipe 只保留可读描述。
- 将 AIOS 集成收敛为 Adapter：AIOS 负责执行宿主和治理增强，不能重新选择 rex 阶段。
- 将 `Fast | Balanced | Deep` 改为基于真实 Activation 的事后执行画像。

## [0.1.0] - 2026-07-16

- 建立模块化 Capability Pack、Provider Contract 和 AIOS Adapter 边界。
