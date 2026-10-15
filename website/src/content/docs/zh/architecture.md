---
title: "架构"
description: "rex-harness 如何同时支持独立控制面与宿主集成，共享同一套 Fact → Capability → Evidence 状态机。"
order: 10
group: concepts
updated: "2026-10-14"
---

## 目标

`rex-harness` 同时支持两种部署方式：

1. **独立控制面**：Coding Agent 原生加载 `rex-workflow`，通过 compact CLI 读取当前 Command，执行后提交 Evidence。
2. **宿主集成**：AIOS 通过完整 JS API 复用同一运行时，并增加 Provider 执行、恢复、安全和审计能力。

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
- `infrastructure/`：`.rex-harness/` 下的项目本地状态持久化。
- `interfaces/`：compact CLI 与面向宿主的 JS API。

## 设计规则

- **一个工作流同一时刻只有一条当前命令。** 给定 Facts 后选择是确定性的；Agent 不需要猜下一步该用哪个 Capability。
- **Fail closed。** 状态损坏、Evidence 类型不匹配、引用没有协议前缀时直接停止，而不是掩盖。
- **接受即轮换。** 证据被接受后命令令牌立即轮换，旧令牌不可重放。
- **Journal 只追加。** 审计不需要数据库 —— `.rex-harness/evidence/` 就是完整历史。

## 边界在哪里

宿主可以覆盖 Provider 可用性与内容检查，但永远不能覆盖 Capability 选择和 Evidence 语义。正是这一条边界让独立模式与宿主模式在语义上保持字节级兼容。
