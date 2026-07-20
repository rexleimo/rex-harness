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
    "acceptance-criteria-recorded",
    "non-goals-recorded",
    "first-slice-identified"
  ],
  "executionToken": "host-or-standalone-token"
}
```

Provider 必须返回真实 Evidence 引用后停止。它不能调用下一 Provider、修改 Activation、重选 Capability 或决定 Team/Harness promotion。

## Evidence

基础规则由 `validateCommandEvidence()` 统一执行：

- 只能提交当前 `expectedEvidence` 中的 kind；
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
