---
name: rex-requirements
description: Use when a request is vague, underspecified, or could be interpreted multiple ways — even when it names a specific feature but acceptance criteria, scope, or success are not yet defined. Also use after rex-harness selects software requirements clarification and supplies the current Command.
---

# Rex Requirements

## 输入与输出契约

接受用户目标、已有决定/规格、仓库事实和当前 Command（若有）。用户显式 `/grill`
或需求模糊时可先调查；只有 rex-harness 已经激活当前 Capability 并提供 Command，
才向该 Activation 提交 Evidence。自助调查不获得实施或选择下一阶段的权限。

产出 `rex.requirements-decision.v1`：验收标准、非目标、第一个可验证切片、结构化
observations 和 `readiness`。完整字段及实例见 `references/readiness-contract.md`。
已有规格和决定原地补充；不要创建第二份实施计划。

## 1. 先展开决策依赖，再解决当前问题

先读 CONTEXT.md、已有需求/决定和相关代码。把影响本次目标的决定组织成依赖图：
每个节点写 `id`、`dependsOn`、`status`、`impact`、`rationale`、`evidenceRefs`。
按目标列出参与者、触发/输入、结果、边界、失败后状态，继续展开这些决定引出的
下游选择。记录不适用项的依据，不用勾完字段冒充思考完成。

当前可处理的 frontier 是前置决定已解决的未决节点。每得到新事实或答案，重新展开
依赖和检查遗漏；不能在上游仍未知时，把下游选择当成已决定。完成的是整个约定范围
的必要决策，不要求先决定所有代码细节，也不把找到第一个切片当成整个需求已想清。

## 2. 事实自己查，决定才问用户

事实从文件、文档、配置、已有证据和必要的最小探针取得，不让用户代查。
先调查和推理；只有改变产品行为、范围或验收的选择才交给用户。
调查尚未完成是未决前置条件，不是可以猜掉的实现细节。

**一次只问一个决策性问题，带理解、选项、推荐答案及依据，等回答后再处理下一个。**
优先问能解锁最多关键下游选择的问题。继续做不依赖答案的调查，保持完整 frontier
可见，不把同轮有依赖的问题一起抛给用户。已有用户决定和授权直接引用，不重复确认。

## 3. 推演流程，并为可行性找证据

在解锁实施前走通一个有代表性的正常路径和一个关键失败/边界路径。逐步说明输入、
执行者/模块、工具或接口、状态变化、输出以及如何观察验收；检查下一步是否实际可用。
记录路径引用到 `walkthroughs.happyPath` 和 `walkthroughs.failurePath`。

对决定方案能否成立的未知（接口能力、权限、数据可得性、恢复能力、依赖顺序等），
先查代码/文档/已有测试；仍无法判断时做最小、可逆、已授权的探针，保留真实结果。
不能把需要新权限、付费或不可逆动作的探针当成已获授权；报告具体缺口并继续独立调查。
`feasibility.status=supported` 必须有对应证据。推演是可行性依据，不是已完成实现的证据。

## 4. 假设和澄清预算不能替代关键决定

- `impact=critical`：答案会改变约定行为/验收、架构可行性、权限/副作用或可恢复性。
  关键节点未解决，或只能假设成立时，必须 `readiness.status=blocked`。
- `impact=low`：可逆且不改变已接受目标、边界和验收的默认值，可标 `status=assumed`，
  写明默认值、理由和后果；不得把关键未知降级成 low 来获得通过。
- 三次交互可作为整理进展和减少打扰的提醒，**不是完成条件**。仍有阻塞时返回
  待决定项/证据/推荐，等待该决定或新事实；禁止“记录假设后立即开工”。
- 用户暂未回答或时间耗尽不构成批准。已有授权或用户明确委托你决定时，在授权范围内
  自行裁决并记录依据；不额外制造确认流程。

## 5. 写回决定并检查是否真的 ready

术语实时写入 CONTEXT.md。已接受且影响边界的决定写入 docs/adr/NNNN-<slug>.md；
未决项和假设留在需求记录，不因预算耗尽就升级为已裁决 ADR。

`ready` 必须同时满足：

1. 验收和非目标覆盖本次约定范围；第一个切片有独立验证方式。
2. 必要决策依赖已闭合，没有 open 节点或 critical assumption；低影响默认值显式记录。
3. 正常/失败路径已推演；决定方案成立的关键事实有依据，feasibility 为 supported。
4. 对齐已有用户目标与决定，alignment 为 confirmed 且引用已有消息/决定；确有新歧义
   才询问，不能为了填写字段再要求一次批准。

程序只验证声明、图结构、引用和状态自洽，无法证明你没有漏掉一条语义分支。
必须主动检查反例和缺口，不能靠把状态填成 ready 获得形式通过。

## 返回与停止

返回 `acceptance-criteria-recorded`（或低影响默认值的 `assumptions-recorded`）、
`non-goals-recorded`（或 `assumptions-recorded`）、`first-slice-identified` 和
`requirements-decision-recorded`，每项附真实的文档/决定/任务引用；提交时同时携带
类型化 `requirementsDecision`。standalone CLI 使用 `--requirements-file <json>`。

blocked 时报告未决节点、缺失事实和下一步条件，不能声称完成或开始实施。即使证据种类
齐全，Rex 工作流也会拒绝缺少 readiness 或 status=blocked 的需求决定，保留当前 Command。
当前澄清命令保留。若旧安装拒绝 `readiness` 字段，报告运行时版本不兼容并保持 blocked；
不得删字段重试、只换成假设证据，或借旧命令绕过准备度。升级配套运行时后再继续。
宿主要求 `AIOS_REX_EVIDENCE` 时，只在结尾输出当前 activationId 的恰好一个证据信封。

需求决定一旦接受，不覆盖其行为/范围。新目标需要新工作流；历史未完成需求可补 readiness，
不能借此静默改写原决定。不要替用户选择未授权的产品行为，也不要调用下一个 Provider。

## 方法来源

借鉴 Matt Pocock Skills v1.3.2 的 decision tree/frontier 和“实施者不再需要追问”标准：
- https://github.com/mattpocock/skills/blob/v1.3.2/skills/productivity/grilling/SKILL.md
- https://github.com/mattpocock/skills/blob/v1.3.2/skills/in-progress/loop-me/SKILL.md

保留单题交互和已有授权复用，并加入证据支持的可行性推演；不照搬每次结束都要新确认。
