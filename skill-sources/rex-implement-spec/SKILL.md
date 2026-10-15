---
name: rex-implement-spec
description: Use when the user hands you a complete spec — one that already has acceptance criteria and a work-item graph — and asks you to implement it end to end. Do not use it for a single ticket or a spec that is still missing acceptance criteria.
---

# Rex Implement Spec

本 Skill 是「整份 spec 端到端实现」的编排入口。它不是 Provider，不选择 Capability，也不预设任何执行链；它只在 rex-harness CLI 的证据闭环之上，安排并行派发与集成收口。

## 定位与边界

- 不绕过当前 Command：所有阶段推进仍由 `rex-harness` 返回的 compact Command 授权。
- 子代理是当前 Command 有界范围内的「双手」：每个子代理执行的任务不能超出当前 Command 的 `stageId` 与 `objective`。
- 不为每张工单发明新的 work-item 语义：一个 spec 对应一个工作项，工单图是工作项内部的计划产物。
- 不加载 rex-workflow 之外的其他编排技能，也不引入第二条 evidence 写入路径。

## 何时使用 / 何时不用

**使用**：用户给出一份含验收标准与工单（工作项）图的 spec，要求整份实现完毕。

**不用**：spec 缺验收标准或缺工单图时，先走当前的 requirements/planning Command 补齐，不要边实现边发明范围；用户只要单个工单时按普通单步执行循环走，不必开编排。

## 前置检查

开始派发前逐项核对，缺一项就停下来补齐，不得带着缺口开工：

1. spec 含明确的验收标准（每条可判定、可验证）；
2. 工单图与 delivery-ticket 契约一致：每张工单有目标、目标文件、验收方式；
3. 并行性核对：至少 2 张工单可并行、它们的目标文件不重叠、且图中没有未声明的先后依赖——有任何重叠或依赖就串行执行，不硬凑并行。

## 执行步骤

1. 建立工作项：

```bash
rex-harness start --work-item <spec-key> --message "<spec 目标>" --root <project-root>
```

2. 经当前 Command 取得工单图：到达 planning 阶段时执行 rex-planning 要求的规划产出，把 spec 的工单图落成带依赖边与验收方式的工作项计划；不要按用户文本猜依赖，以规划产出为准。
3. 建集成分支，并为每张前沿工单从集成分支开独立 git worktree；子代理在各自 worktree 内工作，不直接改共享工作树。
4. 沿前沿并发派发：一次派发当前前沿上所有可并行的工单，每个子代理拿到——目标工单、目标文件、验收方式、上下文指针（不整份 spec 塞给每个子代理）。子代理完成后，先把它合并回集成分支的最新提交，再向主线程报告完成。
5. 推进前沿：已合并工单出图后，解锁下一批工单，重复派发；出现阻塞或验收不过的工单时按当前 Command 的 replan 语义处理，不静默绕过。
6. 收口：全部工单合并后，按当前 Command 进入 rex-code-review 审查；审查发现的问题一次修完，重跑验证，再请求复审。
7. 提交 Evidence：按当前 Command 的 `expectedEvidence` 用真实引用经 CLI 提交：

```bash
rex-harness evidence --activation <activationId> --command-token <commandToken> --evidence <kind>=<protocol:real-ref> --root <project-root>
```

完成的唯一判据是 completion criteria 的验证输出，不是子代理的自我报告。

## 通讯纪律

- 子代理之间不直接通讯；主线程只传上下文指针（文件路径、工单 id、验收条目），不传全文。
- 探索笔记、中间产物写到仓库外的共享目录或集成分支上的临时文件，不污染各 worktree 的提交。
- 任何子代理报告与验证输出矛盾时，以验证输出为准并如实上报。

## 完成与失败边界

- 只有集成分支上全部工单合并、审查收口、Evidence 被接受后才可声明完成。
- Evidence 类型不符、引用不可验证、状态损坏或 token 失效时 fail-closed：停止派发，不伪造证据，向用户报告具体缺口。
- 未收口时如实报告：已合并哪些、阻塞在哪个工单、还差哪些验收标准；不得用部分完成冒充整份交付。
