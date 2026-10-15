---
title: "CLI 命令参考"
description: "rex-harness 全部命令：start、status、evidence、resume、init、doctor —— 参数、退出行为与 .rex-harness 状态布局。"
order: 20
group: reference
updated: "2026-10-14"
---

## 命令总览

| 命令 | 用途 |
| --- | --- |
| `rex-harness start` | 为 work item 创建或重开工作流，只返回一条当前命令。 |
| `rex-harness status` | 只读当前命令，不推进状态。 |
| `rex-harness evidence` | 接受或拒绝类型化证据；接受的证据轮换令牌并推进。 |
| `rex-harness resume` | 中断后从最后一次被接受的状态续转。 |
| `rex-harness init` | 把 `rex-workflow` 与 Provider Skill 投影到客户端发现目录。 |
| `rex-harness doctor` | 验证运行时、状态与投影健康度。 |

## start

```bash
rex-harness start --work-item <id> --message "<任务>"
```

返回 compact 命令对象：当前状态、Provider、`instructionsRef`、阶段目标、Evidence Contract 和一次性 `commandToken`。

## status / resume

```bash
rex-harness status --work-item <id>
rex-harness resume --work-item <id>
```

`status` 只读。`resume` 在旧令牌未使用而过期后，重新发出带有效令牌的当前命令。

## evidence

```bash
rex-harness evidence \
  --activation <activation-id> \
  --command-token <token> \
  --evidence <kind>=<带协议前缀的引用>
```

`--evidence` 可重复。只接受当前 `expectedEvidence` 中的 kind；引用必须带协议前缀（`artifact:`、`command:`、`diff:` 等）。证据被接受后令牌立即轮换 —— 旧令牌失效且不可重放。

## init

```bash
rex-harness init --client codex   # codex | claude | gemini | opencode | hermes | grok | pi | zcode
```

默认不覆盖同名用户文件：内容相同跳过，内容不同报告 conflict。完整 fail-closed 更新规则见 [Provider 契约 → 投影所有权](../provider-contract/)。

## 全局参数

- `--root <project-root>` —— 指定目标项目。
- `--full` —— 返回完整 Workflow 结果，用于诊断或审计。

## 状态布局

```text
.rex-harness/
  workflows/    # 规范 Workflow Activation 与 work-item 索引
  activations/  # 当前 Capability 的便捷投影
  evidence/     # 只追加的 NDJSON Evidence Journal
```

状态读写 fail-closed：状态损坏、Evidence 类型不匹配、引用没有协议前缀或仍是 placeholder/TODO/TBD 时直接停止而不是掩盖。

## 核心 JS API

- `startSoftwareWorkflow()` / `advanceSoftwareWorkflow()` —— 完整的自适应软件工作流运行时。
- `evaluateSoftwareRequest()` —— 从 Fact 选择当前一个 Capability。
- `startActivation()` / `advanceActivation()` —— 单 Capability 的 Evidence 状态机。
- `nextCommand()` —— 只生成当前阶段的一条 Provider Command。
- `validateCommandEvidence()` —— standalone 与宿主 Adapter 共用的 Evidence 基础校验。
- `listSoftwareWorkflowRecipes()` —— 只读的自适应运行时描述。
- `analyzeExecutionProfile()` —— 根据已发生 Activation 计算执行画像。
- `startStandaloneWorkflow()` / `readStandaloneWorkflow()` / `submitStandaloneEvidence()` —— 供宿主使用的完整 standalone JS API。

## 开发验证

```bash
npm test
npm run doctor
```
