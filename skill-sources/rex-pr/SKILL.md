---
name: rex-pr
description: Use when a rex-harness work item has completed and the user asks you to open or author a pull request for it. Do not use it while the workflow is still running or when no PR flow exists.
---

# Rex PR

本 Skill 是 rex-harness 工作流收尾后的 PR 编排入口。它不是 Provider，不选择 Capability，也不推进任何软件阶段；它只把**已收口工作项**的记录整理成可评审的 PR。

## 定位与前提

- 前提是工作流已完成：通过当前环境的 rex 入口执行 `resume`（或 `status`）返回 `status=completed`、`command=null`、`missingEvidence=[]`。未到 completed 就不开 PR——fail-closed，向用户报告还差哪些 Evidence，而不是先开 PR 后补证据。
- 完成判据仍是 CLI 的 completion criteria，不是 PR 本身；开了 PR 不等于工作项多完成了一次。
- 不改写 Evidence 记录，不伪造任何命令输出；PR 里引用的每条证据都必须来自真实执行。

## 何时使用 / 何时不用

**使用**：工作项已 completed，用户要求开 PR、请求评审或交付变更。

**不用**：工作流还在进行中；用户只要本地提交不开 PR；目标仓库没有 PR 流程（直推分支时直接交付，不造 PR 形状）。

## 执行步骤

1. 确认状态：先分清「入口对不对」和「工作项收没收口」——两者失败的意义不同。

   rex 有两种被支持的调用形态，命令名不同：

   - **独立安装**：`rex-harness <cmd>`（包已安装、bin 在 PATH）；
   - **宿主托管**：`aios rex <cmd>`（宿主直接执行内置副本，**故意不装全局 PATH**）。

```bash
   # 独立安装
   rex-harness resume --work-item <key> --root <project-root>

   # 宿主托管
   aios rex resume --work-item <key> --root <project-root>
```

   `command not found` 只说明当前形态的入口名不对，**不构成「rex-harness 未安装」的结论**；先换入口重试，再用 `doctor` 判运行时存在性。只有 `doctor` 报错或内置副本不存在才算未安装，这时如实报告「本环境无 rex 运行时」，不要把它写成工作项没完成。

   `--root` 传的是**工程根**（`.rex-harness/` 状态目录所在处）。`doctor` 是唯一例外：它按 `--root` 找 Provider 的 `skill-sources/`，所以它的 `--root` 要传 **rex 包根**（仓库里的 `rex-harness/`，或宿主内置副本里的 `rex-harness/`）。把工程根喂给 `doctor` 会刷出一堆 `missing Provider instructions` 和 `status: invalid`——那是**参数用错**，不是安装坏了。

   返回 `completed` 才继续；否则停在第 1 步，并写明停的是哪一类：入口名错（换入口重试）/ 运行时不存在（报告未安装）/ Evidence 未收口（报告还差哪些）。

2. 汇集素材：从 `.rex-harness/` 的该工作项记录读取 Evidence 引用、completion criteria、涉及的变更范围；再从 git 读取实际 diff（分支名、相对基线的提交列表）。素材与 Evidence 对不上时如实报告，不自行脑补。

3. 写三节 PR 正文：

   - **最小可视摘要**：一段话问题与方案，前面放一个最小可视形状——diff 概览 / 文件树 / 调用树 / 伪代码 / Mermaid，选最能说明结构的一个，不堆全部细节；
   - **before/after 验证证据**：粘贴真实命令输出（改动前后的关键验证各一条），禁止用勾选框、「已验证」声明或转述替代；
   - **merge danger**：判定 one-way door 还是 two-way door（难回退、影响共享状态、改契约/迁移 = one-way），列出爆炸半径与受影响路径。判不了就写「需要 reviewer 复核」，不写「无风险」。

4. 用客户端原生的 git/gh 能力创建 PR：分支、远程、凭据全部走客户端环境，本 Skill 不引入新的外部服务，不代管凭据。
5. 把 PR 链接与三节正文交给用户；用户要求修改正文时改的是 PR 描述，不是 Evidence 记录。

## 边界

- 不调用下一个 Provider，不触发新的 rex-harness 工作项。
- Evidence 引用不可验证、状态损坏或与 git 实际变更矛盾时 fail-closed，拒绝开 PR 并报告具体矛盾。
- 未收口的工单、跑不过的验收标准，必须在正文里如实列出；不得用 PR 形状掩盖未完成。
