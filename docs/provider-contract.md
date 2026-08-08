# Provider 契约

Provider Binding 是某个语义 Capability 的可执行入口。Catalog 只绑定 rex 自己打包的 Skill 或 Reviewer；集成宿主不能覆盖为外部 Provider。

支持的 Provider 类型：

- `skill`：可发现的 Coding Agent Skill；
- `agent`：根据 `risk-domain` 选择的专项 Reviewer。

Binding 不能包含触发规则。Provider 可用性属于执行宿主；不可用时必须报告，而不是改选一个语义不同的 Provider。

## Command

每次只允许执行当前一条 Command：

```json
{
  "type": "provider.invoke",
  "activationId": "activation-1",
  "capabilityId": "software.requirements.clarify",
  "recipeId": "software.requirements.clarify.recipe",
  "stageId": "clarify",
  "reasonCode": "acceptance-criteria-missing",
  "triggerEvidenceRefs": ["request:current"],
  "provider": {
    "kind": "skill",
    "id": "rex-requirements",
    "source": "bundled",
    "instructionsRef": "skill-sources/rex-requirements/SKILL.md"
  },
  "expectedEvidence": [
    { "anyOf": ["acceptance-criteria-recorded", "assumptions-recorded"] },
    { "anyOf": ["non-goals-recorded", "assumptions-recorded"] },
    "first-slice-identified",
    "requirements-decision-recorded"
  ],
  "executionToken": "host-or-standalone-token"
}
```

`expectedEvidence` 支持 `anyOf` 收敛组：组内任一 kind 满足即算该契约项达成（如验收标准或假设记录二选一），用于为澄清会话提供时间盒出口，防止无限询问；未决项可记录为假设（`assumptions-recorded`）后收敛解锁。

Provider 必须返回真实 Evidence 引用后停止。它不能调用下一 Provider、修改 Activation、重选 Capability 或决定 Team/Harness promotion。

## Evidence

基础规则由 `validateCommandEvidence()` 统一执行：

- 只能提交当前 `expectedEvidence` 中的 kind（`anyOf` 组按组内 kind 展开匹配）；
- 每个 Evidence 必须至少有一个带协议前缀的 ref，例如 `artifact:`、`command:`、`diff:`；
- placeholder、TODO、TBD 和无协议路径被拒绝；
- standalone CLI 和 AIOS 手工入口都必须携带当前 Command token；
- Evidence 被接受后 token 轮换，旧 token 不可重放。

独立 CLI 使用：

```bash
rex-harness evidence \
  --activation activation-1 \
  --command-token <token> \
  --evidence acceptance-criteria-recorded=artifact:requirements
```

AIOS 中的 Skill runner 使用单行 Envelope：

```text
AIOS_REX_EVIDENCE={"schemaVersion":1,"activationId":"activation-1","evidence":[...]}
```

Agent Provider 使用单一原生 JSON Handoff，字段为：

```text
schemaVersion, agentId, role, status, findings, blockers,
evidenceRefs, filesReviewed, recommendedNextSteps
```

AIOS 额外验证 Agent 身份、角色、晋级和执行证据，保存 Handoff artifact，再适配为 rex typed Evidence。这个协议与 Team/Subagent 的通用交接协议不同，不能混用。

AIOS 只能执行当前 Rex Command 中绑定的内置 Provider；它不会加载外部 playbook 或把第三方仓库 vendoring 到 `rex-harness`。

## Client Projection Ownership

`installClientProjection()` 在每个 Rex-managed Skill 目录写入 `.rex-projection.json`。marker 记录 canonical payload 的 SHA-256；marker 自身不参与 payload digest。marker 是一致性元数据，不是可单独伪造的 ownership 证明。

更新规则 fail-closed：

- 所有 canonical source、当前 digest、history 和目标快照先完成 preflight，缺 source 不会留下前序部分安装；
- 目标不存在时 staged install；提交前若目标被创建则返回 conflict；
- payload 与 canonical 完全相同且没有 marker 时，可以安全 adopt；marker/link 非普通文件时拒绝写入；
- 破坏性 update 只有在 target payload 命中 `src/clients/projection-history.json` 的审核 canonical digest 时才允许，合法 marker 本身不足以授权覆盖；
- staging 期间目标发生变化、目标为 symlink/junction、marker 无效或未知用户内容一律保留并报告 conflict；
- 替换前的旧目录不会自动删除，而会保留在 discovery root 外的 `.rex-projection-recovery/`，用于崩溃/回滚恢复。

结果返回互斥的 `installed`、`updated`、`migrated`、`adopted`、`skipped`，以及 `conflicts`、`errors`、`recoveries` 和带 digest/reason 的 `conflictDetails`。AIOS lifecycle 必须把 update/migrate/adopt 视为实际变更，不能误报 `unchanged`。
