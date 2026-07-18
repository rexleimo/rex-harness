# Repository Guidelines

## Product boundary

`rex-harness` 是可独立运行的软件工程控制面，不是只能被 AIOS 加载的 Capability Pack。

它拥有 Fact、Capability、Capability Recipe、Software Workflow Runtime、Activation、Command、Evidence Contract，以及 `.rex-harness/` standalone 状态和 Evidence Journal。它不得实现 ContextDB、RTK、Headroom、Team、模型进程管理、AIOS 长任务 Harness、隐私代理或 AIOS 审计系统。

## Module rules

- `domain/` 保持纯语义模型，不依赖 Provider、CLI 或持久化。
- 每个 Capability 在 `src/capabilities/<name>/` 下垂直聚合。
- `application/` 负责 Fact 推导、选择、Activation 推进和公共 Evidence 校验。
- `workflows/` 只保留一份可执行的软件工作流状态机；静态描述只能投影该运行时，不能复制续转规则。
- `standalone/` 可以持久化 `.rex-harness/`，但不能读取 `.aios/` 或导入父项目私有模块。
- `cli/` 负责参数和 compact 呈现，不得重新实现 Activation 策略；`--full` 只投影 JS API 已有的完整结果。
- `rex-workflow` 是独立 Agent 的编排入口；一次只加载当前 Provider，完整历史保留在 `.rex-harness/`。
- 核心包不实现 MCP Server；协议适配只能作为调用公共 CLI/JS API 的可选外部包。
- Capability ID 必须与 Provider 无关。`src/providers/` 只提供可移植默认提示；集成宿主拥有最终可执行绑定。
- 不得导入 `harness-cli/scripts/lib/**` 私有模块。
- 不得新增 `utils`、`common`、`helpers`、`misc`、`services` 或 `shared` 兜底目录。
- 复杂控制流和边界注释使用中文；显而易见的代码不添加逐行注释。

## State and evidence

- 每个 Workflow 同时只能有一条 current Command。
- Evidence 必须匹配当前 `expectedEvidence`，引用必须带协议前缀。
- 每次接受 Evidence 后轮换 Command token，拒绝旧 token 重放。
- 状态读取和写入 fail-closed；Evidence Journal 只追加，不覆盖历史。

## Verification

在本目录运行：

```bash
npm test
npm run doctor
```

Activation 或 Workflow 行为变更必须有场景测试；目录边界变更必须有架构测试；CLI/状态变更必须有 standalone 测试。Skill 变更还需要 eval 与训练证据后才能晋级。
