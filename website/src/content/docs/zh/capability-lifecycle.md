---
title: "Capability 生命周期"
description: "从 Observation 到 Evidence 的九步循环、四种转移结果、晋级与执行画像。"
order: 11
group: concepts
updated: "2026-10-14"
---

## 循环

1. 宿主（独立模式则是你）提供规范化 Observation 与 Evidence 引用。
2. rex-harness 推导或接收软件工程 Fact。
3. 组合根**至多选择一个**流程 Capability。
4. rex-harness 启动 Activation，保存 `reasonCode` 与 `triggerEvidenceRefs`，返回当前 recipe-stage Command。
5. Profile 与宿主覆盖把 Capability 解析为一个 Provider Binding。
6. 宿主执行 Provider；Agent 型 Provider 先解析真实角色、验证晋级证据，再记录原生 Handoff artifact。
7. rex-harness 校验当前阶段的 Evidence Contract。
8. 缺失证据则阻塞在同一阶段；有效证据推进到下一阶段或关闭 Activation。
9. 完成后，宿主向 rex-harness 请求下一个合格 Capability。

已观测到的执行失败拥有最高优先级，会抢占面向实现的 Capability。已完成的 Capability 必须出现在 `completedCapabilities` 中，下一个合格 Capability 才能运行。

## 转移结果

| 结果 | 含义 |
| --- | --- |
| `blocked` | 保留已收到的部分证据，停留在同一阶段，返回缺失的 Evidence Kind。 |
| `next` | 进入同一 Capability Recipe 的下一阶段，生成一条新 Command。 |
| `completed` | 关闭 Activation，不再生成 Command。 |
| `promotion-requested` | 由宿主接受或拒绝 Team / Harness 运行时晋级。 |

宿主模式下 AIOS 把该状态投影到 `.aios/workflow-activations/`。那个目录不是 rex-harness 的存储实现，而是父 Adapter 对 rex 纯状态机的持久化。

## 晋级

`decidePromotion()` 可能为独立工作流请求 `team`、为连续性要求请求 `harness`。它从不启动任何一种运行时；接受或拒绝晋级是宿主的权力。

## 画像

Profile 启用 Capability 并声明宿主保障要求，但**不**把任务分类为 Fast / Balanced / Deep。`analyzeExecutionProfile()` 在执行之后根据真实 Activation 推导这些标签 —— 画像是观测结果，永远不是预选路由。
