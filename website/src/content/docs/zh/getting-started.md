---
title: "快速上手"
description: "安装 rex-harness，把 Provider Skill 投影到你的 Agent，两分钟跑通第一个证据驱动工作流。"
order: 1
group: getting-started
updated: "2026-10-14"
---

## 环境要求

- Node.js 24。无服务、无 MCP Server、无常驻进程。
- 你已经在用的 Coding Agent：Codex、Claude Code、Gemini CLI、OpenCode、Hermes、Grok、Pi 或 ZCode。

## 安装

```bash
npm install -g @rexleimo/rex-harness
rex-harness --version
```

独立内核拥有 Fact、Capability、Recipe、Activation、Command 和 Evidence 契约的全部语义。一切状态保存在项目本地。

## 投影 Skill 到你的 Agent

```bash
rex-harness init --client codex      # 或 claude | gemini | opencode | hermes | grok | pi | zcode
```

`init` 会把 `rex-workflow` 编排入口和当前可执行的内置 Provider Skill 投影到客户端标准发现目录（如 `.agents/skills/`、`.claude/skills/`）。用 `rex-harness doctor` 诊断安装状态。

## 第一次运行

```bash
rex-harness start --work-item checkout \
  --message "实现结账前先澄清验收标准。"
rex-harness status --work-item checkout
rex-harness evidence \
  --activation <当前激活 id> \
  --command-token <当前令牌> \
  --evidence acceptance-criteria-recorded=artifact:requirements
rex-harness resume --work-item checkout
```

`start` 为每个 work item 创建或重开一个工作流，只返回一条当前命令；`status` 只读当前命令、不推进状态；`evidence` 接受或拒绝类型化证据，被接受的证据会轮换一次性命令令牌并推进工作流；`resume` 在中断后从最后一次被接受的状态续转。

## 推荐阅读

- [架构](../architecture/) —— 两种部署方式与模块所有权。
- [Capability 生命周期](../capability-lifecycle/) —— Capability 如何被选择与推进。
- [CLI 命令](../cli-reference/) —— 全部命令与参数。
