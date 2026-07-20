# rex-harness

`rex-harness` 是一个可独立运行的软件工程工作流内核。它读取 Coding Agent 的任务和结构化 Observation，推导 Fact，一次只选择一个 Capability，发出当前 Provider Command，并用类型化 Evidence 决定阻塞、续转或完成。

它可以单独辅助 Codex、Claude、Gemini、OpenCode、Hermes、Grok Build 或其他支持目录型 Skill 的 Agent；接入 `harness-cli / AIOS` 后，再获得模型执行、ContextDB、Team、长任务恢复和安全治理等宿主增强。

独立安装只使用 rex 自己实现的需求、设计、规划、测试设计、基础/严格 TDD、根因调试、最小构造、实施、代码审查、专项审查和 Wayfinding Provider。外部 playbook 不属于支持路径，也不是运行依赖。

## 独立使用

不需要 AIOS、ContextDB、MCP Server 或常驻服务：

```bash
rex-harness start \
  --work-item checkout \
  --message "Clarify acceptance criteria before implementing checkout."

rex-harness status --work-item checkout

rex-harness evidence \
  --activation <current-activation-id> \
  --command-token <current-token> \
  --evidence acceptance-criteria-recorded=artifact:requirements

rex-harness resume --work-item checkout
```

`start`、`status`、`resume` 和 `evidence` 默认返回 `rex.cli.workflow-command.v1` compact 对象，只包含当前状态、Provider、`instructionsRef`、阶段目标、Evidence Contract 和一次性 `commandToken`。Coding Agent 只执行该 Command 指定的 Provider 和目标，然后提交真实 Evidence；被接受后 token 会轮换，旧 token 立即失效。

需要诊断或审计时添加 `--full`，CLI 才返回完整 `rex.standalone.workflow-result.v1`。JS API 始终保留完整 Workflow 对象，供 AIOS 等宿主直接集成。

默认状态保存在项目本地：

```text
.rex-harness/
  workflows/    # 规范 Workflow Activation 与 work-item 索引
  activations/  # 当前 Capability 的便捷投影
  evidence/     # 只追加的 NDJSON Evidence Journal
```

可用 `--root <project-root>` 指定目标项目。状态损坏、Evidence 类型不匹配、引用没有协议前缀或仍是 placeholder/TODO/TBD 时会 fail-closed。

## 接入 Coding Agent

把 `rex-workflow` 编排入口和当前可执行的内置 Provider Skill 投影到客户端标准发现目录：

```bash
rex-harness init --client codex
rex-harness init --client claude
rex-harness init --client gemini
rex-harness init --client opencode
rex-harness init --client hermes
rex-harness init --client grok
```

默认不会覆盖同名用户文件；重复内容会跳过，不同内容会报告 conflict。Agent 原生加载 `rex-workflow`，由它调用 CLI、读取 compact Command，再按 `providerId` / `instructionsRef` 延迟加载当前 Provider。专项 Reviewer Catalog 作为 `rex-workflow` 的按需 reference 一起安装，因此独立模式不依赖第二个服务。

核心包不内置 MCP。若未来需要 MCP，应由独立可选适配包调用这里的 CLI 或 JS API，不能复制工作流状态机。

## 控制循环

```text
Request / Observation
  -> Fact
  -> one Capability Activation
  -> one Provider Command
  -> Coding Agent executes the Command
  -> typed Evidence
  -> blocked | next Command | completed
```

`Fast | Balanced | Deep` 是根据真实 Activation 事后计算的执行画像，不是根据提示词长度预选的路由。

## 核心 API

- `startSoftwareWorkflow()` / `advanceSoftwareWorkflow()`：完整的自适应软件工作流运行时。
- `evaluateSoftwareRequest()`：从 Fact 选择当前一个 Capability。
- `startActivation()` / `advanceActivation()`：单 Capability 的 Evidence 状态机。
- `nextCommand()`：只生成当前阶段的一条 Provider Command。
- `validateCommandEvidence()`：standalone 与宿主 Adapter 共用的 Evidence 基础校验。
- `listSoftwareWorkflowRecipes()`：只读的自适应运行时描述，不是第二套固定状态机。
- `analyzeExecutionProfile()`：根据已发生 Activation 计算执行画像。
- `startStandaloneWorkflow()` / `readStandaloneWorkflow()` / `submitStandaloneEvidence()`：供宿主使用的完整 standalone JS API。

## 与 harness-cli / AIOS 的关系

| 能力 | rex-harness 独立模式 | harness-cli / AIOS 增强模式 |
| --- | --- | --- |
| Fact、Capability、阶段顺序、Evidence Contract | rex 拥有 | 复用 rex |
| Workflow Activation、start/status/evidence/resume | `.rex-harness/` | AIOS 持久化为宿主投影 |
| 对外协议 | `rex-workflow` + compact CLI，`--full` 诊断 | 直接调用完整 JS API |
| 内置 Provider 与可用性检查 | rex 提供并由 Doctor 验证 | 复用 rex；不支持外部覆盖 |
| 调用 Coding Agent / 模型 | 外部 Agent 或人工执行当前 Command | AIOS runner 执行 |
| ContextDB、Team、可恢复 Harness | 不包含 | AIOS 提供 |
| RTK、Headroom、隐私、安全门、审计 | 不包含 | AIOS 提供 |

AIOS Adapter 只保留 rex-native Provider，并直接调用 JS API，不解析 CLI stdout，也不注册 rex MCP。它不能替换 Provider、重选 Capability、重排阶段或从 Team/Harness 路由覆盖 Provider。软件工作流的唯一运行时事实源是 `src/workflows/software-workflow-runtime.mjs`。

## Provider 组合

Capability ID 与 Provider 无关。Catalog 只包含 `rex-*` 内置 Provider。Provider 不拥有触发权，也不能自行调用下一 Provider。

## 开发验证

```bash
npm test
npm run doctor
```

参见 [架构说明](docs/architecture.md)、[Capability 生命周期](docs/capability-lifecycle.md)、[工作流所有权](docs/workflow-ownership.md) 和 [Provider 契约](docs/provider-contract.md)。
