# 架构

## 目标

`rex-harness` 同时支持两种部署方式：

1. 独立控制面：Coding Agent 原生加载 `rex-workflow`，通过 compact CLI 读取当前 Command，执行后提交 Evidence。
2. 宿主集成：AIOS 通过完整 JS API 复用同一运行时，并增加 Provider 执行、恢复、安全和审计能力。

两种方式必须共享同一套 Fact、Capability、Activation 和 Evidence 语义，不能各自维护状态机。

## 所有权

| 关注点 | rex-harness | 集成宿主（例如 AIOS） |
| --- | --- | --- |
| Request / Observation 规范化 | 是 | 可采集并传入 |
| 软件工程 Fact 和 Capability 选择 | 是 | 不得重选 |
| Capability Recipe 与 Evidence Contract | 是 | 不得重写 |
| Software Workflow Activation 与续转 | 是 | 持久化并调用公共 API |
| standalone 状态与 Evidence Journal | 是 | 不需要使用 |
| rex-native Provider 内容与可用性检查 | 是 | 默认复用，可显式覆盖 |
| Coding Agent / 模型进程执行 | 否 | 是 |
| ContextDB、Team、长任务 Harness、RTK/Headroom | 否 | 是 |
| 宿主安全、隐私、恢复和审计 | 否 | 是 |

## 模块

- `domain/`：Observation、Fact、Capability、Evidence、Activation、Command 的稳定词汇。
- `capabilities/`：垂直聚合的 Capability 和内部 Recipe。
- `application/`：Fact 推导、Capability 选择、Activation 生命周期和 Evidence 校验。
- `kernel/`：Capability Pack 的唯一组装点，连接语义 Capability、Profile 和 rex-native Provider Catalog。
- `workflows/software-workflow-runtime.mjs`：唯一可执行的软件工作流状态机。
- `workflows/software-recipes.mjs`：运行时的只读发现/UI 描述；候选阶段是条件集合，不是执行序列。
- `standalone/`：`.rex-harness/` 原子持久化、work-item 恢复和只追加 Evidence Journal。
- `cli/`：`start/status/evidence/resume/init/explain/doctor` 的参数与 compact 呈现；`--full` 仅用于诊断。
- `providers/`：rex-native Provider Catalog，不拥有触发规则。
- `skill-sources/`：`rex-workflow` 编排入口、内置 Provider 的真实执行说明，以及按需专项 Reviewer Catalog。
- `clients/`：把 rex Skill 投影到 Codex、Claude、Gemini、OpenCode、Hermes、Grok Build 的标准发现目录；AIOS 集成契约负责检测两边客户端注册表漂移。
- `aios/`：只保留可序列化 Manifest 投影，不依赖 AIOS 私有代码。
- `composition-root.mjs`：从 Fact 选择当前一个 Capability。

## 依赖方向

```text
domain <- capabilities <- kernel capability pack
   ^            ^
   |            |
application ----+
   ^
   |
workflow runtime <- standalone store <- public JS API <- external host adapter
                         ^
                         |
                  compact CLI <- rex-workflow Skill
```

父项目只能通过 `src/index.mjs` 公共入口消费 rex。`rex-harness` 不导入 `harness-cli/scripts/lib/**`，因此可以独立发布、测试和嵌入其他 Agent 工具。

核心包不提供 MCP Server。可选协议适配必须位于独立包，并调用公共 JS API 或 CLI，不能进入上述依赖链或复制状态机。

## 两层状态机

- Capability Recipe：单个 Capability 内部阶段，例如基础/严格 TDD 的 `red -> green -> refactor`。
- Software Workflow Runtime：完成一个 Capability 后，重新基于 Fact、已完成 Capability 和 Evidence 选择下一个 Capability。

TDD Capability 在 Workflow 层只出现一次。`red/green/refactor` 不复制到 Workflow 描述；rex 独立模式可从内置 Catalog 读取专项 Reviewer，AIOS 还可以把 `risk-domain` 解析为已晋级的具体 Agent。

## 持久化

独立模式写入 `.rex-harness/`：

- Workflow JSON 是规范状态；
- work-item 索引用于 resume；
- Activation 文件是便捷投影；
- Evidence 以 NDJSON 追加，保留命令、token 对应阶段和真实引用。

写入采用临时文件加原子替换。损坏状态不会被猜测性修复，而是阻塞并要求显式处理。
