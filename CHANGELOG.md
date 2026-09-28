# Changelog

本文件记录 `rex-harness` 独立产品的公开变化。版本遵循 Semantic Versioning。

## [0.8.0] - 2026-09-28

### Fixed

- **工程标准真正被触发**：`rex-engineering-standards` 之前随包发布但没有任何地方引用它，所
  以“基线”只是一份不会被加载的文档。现在 `rex-implement` / `rex-design` / `rex-code-review` /
  `rex-refactor-hardening` 四个代码生产类 Provider 技能把“先读该标准”写为流程第一步，
  并把文件粒度约束归入各自的完成自查门。
- `tests/skills/skill-sources.test.mjs` 新增触发链守卫：四个 Provider 技能必须点名每个共享参照
  技能，否则构建失败——防止同类“零引用技能”静默回归。

### Added

- `rex-engineering-standards` 新增§4 文件粒度基线（单一职责、~400 行软预算、kebab-case 命名、
  禁止语义空洞拆分）与对应的 Definition of Done 条目；其余章节顺序号同步上提。
- `scripts/refresh-projection-history.mjs`：从真实技能目录重算 canonical digest 并追加登记到
  `src/clients/projection-history.json`，修正“改了技能忘登记投影升级凭证”这一类缺陷。

### Changed

- **导出重命名**：`src/clients/install.mjs` 的 `rexSharedSkills`（对象数组）改为
  `sharedReferenceSkillIds`（技能 id 字符串数组）。名称直接表达“随投影分发、但非 Capability
  Provider”的语义；共享技能无需额外元数据字段。0.x 内的破坏性导出变更，因此抬 minor 版本。
- 投影计数保持 14 个技能；Qoder 客户端技能根（`.qoder/skills`）保留。

验证：`npm test` 215/215 通过；`rex-engineering-standards` 历史 digest 保位（append-only）。

## [0.7.0] - 2026-09-21

### Added

- **工程质量基线技能 `rex-engineering-standards`**：代码生产类 Capability（`rex-implement` / `rex-refactor-hardening` / `rex-code-review` / `rex-design`）的共同质量基线与 Definition of Done 现在随 rex-harness 一起发布——Clean Architecture 依赖规则与边界纪律（高内聚低耦合、最小接口、命名即边界测试）、Ousterhout 深层模块（小接口深实现、警惕浅模块与预留参数、战略编程优于战术编程）、Clean Code 命名/函数/错误处理规则、DRY 与正交性、测试担保基线、工具链基线（新项目必须带 lint + pre-commit + CI + 测试框架 + 结构化日志）、consequential 改动的 ADD 文档基线。独立使用 rex-harness（无 AIOS 宿主）时质量基线不再缺失。
- `src/clients/projection-history.json` 登记新技能的 canonical digest，客户端投影升级路径开箱即用。

### Changed

- 技能目录由 13 个增至 14 个；消费方（AIOS）的 `rex-client-projection` 采用计数与投影校验同步适配。

### Fixed

- **技能投影 digest 登记**：v0.6.1 修改 `skill-sources/rex-test-design/SKILL.md` 后，`src/clients/projection-history.json` 未同步登记新的 canonical digest，导致消费方（AIOS）的客户端投影校验与 CI `scripts-tests` 全部失败；现补记该 digest，投影升级路径恢复。

## [0.6.1] - 2026-09-16

### Fixed

- **`rex-test-design` 技能文档编码修复**：`skill-sources/rex-test-design/SKILL.md` 在历史提交中被破坏的中文标点（原以 `U+FFFD` 占位）按语义重建，技能说明阅读与复制不再出现乱码。
## [0.6.0] - 2026-09-13

### Added

- **Turn 契约结算门（借鉴 LoopX settlement）**：新增 `rex.turn-result.v1` 类型化 envelope（`deriveEffectRef` 以 executionToken+payload sha256 为幂等键；material 结果必须携带结构化证据）与 `settleStandaloneTurn` 结算流程——自洽性 → 幂等重放 → token 授权 → 状态回滚不变量（`state_rollback_detected`）→ bypass 封印 → 证据校验 → CAS 写回（`writeWorkflow` 支持 expected-status 前置条件）→ append-only settlement journal。
- 独立 validator 进程：`rex-harness verify`（stdin 读 envelope、exit 0 放行、只读）与 `rex-harness settle`（唯一结算写路径）；executor 不得自验完成声明由进程边界保证。
- SDK 新增导出：`settleStandaloneTurn`、`readStandaloneSettlements`、turn-contract 常量与工具；非 material 结果（blocked/replan）记账但不推进、不轮换 token。

## [0.5.1] - 2026-08-08

### Added

- **需求澄清收敛契约（防死循环）**：`software.requirements.clarify` 的 requiredEvidence 新增 `anyOf` 收敛组（`acceptance-criteria-recorded` 或 `assumptions-recorded` 二选一），澄清会话有明确时间盒出口；累计多轮未收敛时记录假设（`assumptions-recorded`）即可解锁开发，未决项随交付物交付，杜绝"无限询问、永不执行"。
- 新增 `ASSUMPTIONS_RECORDED` 事实（`assumptions-recorded`），承载澄清超预算后的假设记录证据。

### Changed

- `derive-facts` 结构性需求缺失推导：在 `hasMissingRequirementsSignal()` 中补充泛化目标分支——泛化优化动作 + 无验收描述 + 无特指功能实体（如"优化一下前端页面"）自动产生 `acceptance-criteria-missing`，覆盖 `VAGUE_BEHAVIOR_PATTERN` 未命中的目标词；排除完成时态与名词化陈述（"优化方案提交了"）误报。
- `evaluateEvidence()`、`validateCommandEvidence()`、`capability-pack` 契约校验、`software-workflow-runtime` 的 `commandContract` 支持 `anyOf` 收敛组；字符串契约项行为保持向后兼容。
- `rex-requirements` Skill 增加"查 → 推 → 猜 → 问"思考优先级链、带假设提问（Ask-with-hypothesis）与澄清预算（3 轮收敛）行为准则；新增第 3 条 eval（假设收敛场景）并追加 projection history digest。

### Fixed

- `commandContract` 不再把 `anyOf` 收敛组误判为非法 expectedEvidence（此前会导致 requirements 阶段 advance 返回 `command-invalid` blocked）。

## [0.5.0] - 2026-08-01

### Added

- 新增 `normalizeEvidenceRefs()`：集中校验所有 Artifact 的 evidence ref，必须带协议前缀（`artifact:`、`receipt:` 等），拒绝 TODO/TBD/placeholder 占位符，覆盖 Wayfinder、Planning 和 Requirements 全部 Artifact。
- 新增 `src/domain/wayfinder-artifact.mjs`：Navigation Map、Decision Graph、Decision Ticket、Next Slice 的完整 schema 校验；partial 状态不得声明 Decision Ticket 或 Next Slice。
- 新增 `src/domain/planning-artifact.mjs`：vertical Delivery Ticket、Frontier（ready/blocked 互斥）、Parallel Group（不允许跨组重复引用同一工作项）、Convergence Gate、Runtime Artifact Contract 校验。
- 新增 `src/domain/review-verdict.mjs`：Standards/Spec Review 判决 schema。
- 新增 `src/clients/projection-manifest.mjs`：集中管理 Skill projection source 目录和 target 路径，替代原有散布在 `install.mjs` 的文件路径。
- 新增 `tests/domain/wayfinder-artifact.test.mjs`、`tests/domain/planning-artifact.test.mjs`、`tests/domain/review-verdict.test.mjs`：全覆盖各 Artifact schema 正反向用例。
- 新增 Wayfinder Skill（S3）eval 和 Planning Skill（S3）eval；S4/S5 批次（rex-code-review、rex-design、rex-strict-tdd、rex-refactor-hardening、rex-minimal-construction、rex-test-design、rex-workflow）完成 eval 更新和 projection history 追加。

### Fixed

- `recoverInterruptedArtifacts` 恢复中断备份前，现在重新验证 marker digest 是否在受管 `projection-history.json` 记录中，防止伪造 junction 被提升为正式 Skill 目录；拒绝时返回 `interrupted-backup-untrusted` 冲突原因。
- Activation store 改为写前事务（`.aios/workflow-activations/transactions/<id>.json.pending`）：写入前先落 pending 文件，写完后删除；重启时 roll-forward 残留事务；读取时校验 projection 与 workflow 文件一致性，不一致 fail-closed（`stale-activation-projection`）。
- 同一 Command token 现在通过 store 文件锁串行化；并发写入返回 `AIOS_REX_STORE_BUSY`，不再静默接受重复推进。
- `syncEvidenceToMatchingPlan`（plan evidence mirror）失败时不再 throw，而是返回 `planEvidence.status = 'failed'`，保留已提交的 Rex 状态可见性。
- Wayfinder `evidenceRefs` 和 Planning `evidenceRefs`/`decisionTicketRef`/`runtimeArtifactContract.artifactRef` 现在统一经过 `normalizeEvidenceRefs()`；旧版只校验字段存在，现在同时校验协议格式。
- Planning Frontier `ready`/`blocked` 不得重叠、不得列出同一工作项两次；Parallel Group 不得在不同组中重复引用同一工作项。

### Changed

- `recoverInterruptedArtifacts` 签名由 `(targetRoot, skillId)` 改为 `(targetRoot, plan)`，`plan` 包含 `skillId`、`sourceDigest`、`historicalDigests`，使调用方可在不重新读取 history 文件的情况下完成全量校验。
- 13 个 canonical Skill source（S1–S5 全批次）通过独立 SkillOpt eval 更新；所有变更 Skill 的当前 digest 已追加到 `projection-history.json`，旧 digest 保留用于 rollback。

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
