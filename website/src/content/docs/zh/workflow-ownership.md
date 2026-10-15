---
title: "工作流所有权"
description: "rex-harness 与 AIOS 这类集成宿主之间一句话能说清的边界。"
order: 13
group: concepts
updated: "2026-10-14"
---

## 一句话边界

`rex-harness` 决定软件工程下一步做什么，提供默认执行 Provider，并独立保存/推进语义工作流；`AIOS` 默认复用该 Command，再增加模型执行和宿主治理。

## rex-harness 拥有

- 从 Request / Observation 推导带证据引用的 Fact；
- 一次选择一个 Capability；
- Capability Recipe、阶段目标和 Evidence Contract；
- `adaptive-software-delivery` Workflow Activation 和续转历史；
- 当前唯一 Provider Command；
- `.rex-harness/` standalone 状态、恢复入口和 Evidence Journal；
- rex-native Provider Catalog、执行说明、`rex-workflow` 客户端投影、compact CLI 和执行画像分析。

`listSoftwareWorkflowRecipes()` 只投影一个 `adaptive-software-delivery` 描述。其中所有阶段都是 `conditional` 候选，真正的选择和顺序由 `software-workflow-runtime.mjs` 决定 —— 唯一的运行时事实源。

## 宿主（AIOS）额外拥有

- `direct | guarded | planned` 宿主处置；
- 可选 Provider 覆盖和具体 Agent 晋级检查；
- Coding Agent / 模型进程执行；
- Plan、ContextDB、Team、长任务 Harness 与跨会话恢复；
- pre-edit、验证、隐私、安全、压缩和审计门禁；
- `.aios/workflow-activations/` 的 rex Workflow 宿主投影。

宿主必须调用 rex 的 `startSoftwareWorkflow()` / `advanceSoftwareWorkflow()`，不能根据完成记录再次自行推导下一 Capability。`executionHost = single | team | harness` 只选择运行形态，不能覆盖当前 Command 的 Provider。

## 默认 Provider 分工

- `rex-requirements`：有边界的需求澄清；
- `rex-design` / `rex-planning` / `rex-wayfinder`：关键决定、依赖图和未知路径探索；
- `rex-test-design` / `rex-tdd` / `rex-strict-tdd`：测试范围契约和风险分级 TDD；
- `rex-debug` / `rex-minimal-construction` / `rex-implement`：根因、最小构造和有边界实施；
- `rex-code-review` / `rex-refactor-hardening`：标准与规格审查、保持行为的加固。

Provider 不拥有触发权。首次请求不能预装整条 Provider 链；每个 Provider 只执行当前 Command，返回 Evidence 后停止。

## 独立模式如何辅助 Coding Agent

独立模式不负责启动某个特定 Agent 进程，而是提供稳定控制协议：

1. Agent 原生加载 `rex-workflow`，调用 `start` 或 `resume` 读取当前 compact Command；
2. 只执行 Command 指定的目标；
3. 用当前 token 提交真实 Evidence；
4. 读取下一条 Command，直到 Workflow 完成。

因此 Codex、Claude、Gemini、OpenCode、Hermes、Grok Build、Pi、ZCode 只需运行 CLI 并使用 `init --client` 安装 Skill，无需安装 AIOS。嵌入式宿主直接调用公共 JS API；核心包不要求或注册 MCP。
