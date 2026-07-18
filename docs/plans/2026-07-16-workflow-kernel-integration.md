# rex-harness 工作流内核与 AIOS 集成计划

> 状态：集成边界仍有效，但默认 Provider 决策已更新为 rex-native-first。Matt、Superpowers、ECC、Ponytail 只在 AIOS 显式 `compatibilityMode` 中覆盖。

## 问题

当前实现已经有 Provider-neutral Capability，但还缺少把一次软件工程请求推进到完成的应用层。与此同时，`harness-cli` 的 Router 和 Recipe 又直接描述了 Matt、Superpowers、ECC、Ponytail 的选择顺序，形成了两套工作流所有权：

- `rex-harness` 只能说明“有哪些能力”，不能说明“当前执行哪个阶段、证据是否足够、下一步是什么”；
- `harness-cli` 通过 `balanced`、`wayfinder` 和固定 Agent Recipe 决定软件工程步骤，替代了本应由 `rex-harness` 持有的语义；
- 首次路由一次注入整条 Skill 链，后续步骤不依赖真实证据，无法形成可恢复的状态机。

## 所有权决定

### rex-harness 拥有

1. 从 AIOS Observation 推导可追溯的软件工程 Fact；
2. 选择当前一个 Capability；
3. Capability 内部 Recipe、阶段目标和 Evidence Contract；
4. Activation 的开始、推进、阻塞和完成状态；
5. Provider-neutral Command，以及 Capability 到默认 Provider 的绑定；
6. 软件工程 Workflow Recipe 的步骤组合；
7. Fast / Balanced / Deep 的事后分析标签，不把标签用作输入路由。

### harness-cli / AIOS 拥有

1. `direct | guarded | planned` 宿主策略和计划持久化；
2. Skill、Playbook、Agent、模型和进程的实际执行；
3. ContextDB、Activation Ledger、Evidence Artifact 的持久化；
4. Team、Harness、恢复、重试、隐私、安全、RTK、Headroom；
5. 将 rex 的 Provider-neutral Command 绑定到本仓库已经安装的 Provider；
6. 将 rex 软件 Workflow Recipe 投影成 AIOS Agent Recipe，并检查 Agent smoke 与宿主质量门证据。

Skill、Playbook 和 Agent 只执行已经被选中的步骤，不决定自己何时触发。

## 目标调用链

```text
AIOS request / observation
-> rex-harness derive Fact
-> rex-harness select Capability
-> rex-harness start / advance Activation
-> rex-harness return current Command
-> AIOS bind and execute one Provider
-> AIOS persist Result + Evidence refs
-> rex-harness validate Evidence Contract
-> next / completed / blocked / promotion-requested
```

## rex-harness 模块

```text
src/
|-- domain/
|   |-- observation-kinds.mjs
|   |-- activations.mjs
|   |-- commands.mjs
|   `-- evidence.mjs
|-- application/
|   |-- derive-facts.mjs
|   |-- evaluate-request.mjs
|   |-- start-activation.mjs
|   |-- advance-activation.mjs
|   `-- evaluate-evidence.mjs
|-- capabilities/<capability>/capability.mjs
|-- workflows/software-recipes.mjs
|-- kernel/
|-- providers/
|-- clients/
|-- mcp/
`-- aios/  # 仅 Manifest 投影
```

`capabilities/` 继续保持垂直聚合。每个 Capability 直接拥有自己的 Recipe，避免单独建立一个横向 `recipes/` 目录把触发逻辑、阶段和证据拆散。

## 公共契约

### Request 评估

```js
evaluateSoftwareRequest({
  message,
  explicitIntent,
  observations,
  completedCapabilities,
  profile,
})
```

返回推导出的 Fact、当前 Capability Decision 和可选的 Team/Harness Promotion Request。一次最多返回一个当前 Capability。

### Activation

```js
startActivation(decision, { activationId })
nextCommand(activation, { providerBindings })
advanceActivation(activation, evidence, { providerBindings })
```

Command 只包含当前阶段：

```js
{
  schemaVersion: 1,
  type: 'provider.invoke',
  activationId,
  capabilityId,
  recipeId,
  stageId,
  provider,
  objective,
  expectedEvidence,
}
```

Evidence 必须包含 `kind` 和非空 `refs`。缺少阶段所需 Evidence 时，推进结果为 `blocked`，不会越过阶段；最后阶段通过后返回 `completed` 且不再生成 Command。

## AIOS Adapter

新增 `scripts/lib/workflows/rex-harness-adapter.mjs`：

- 调用 rex 公共 API，不读取 rex 私有模块；
- 默认保留 rex-native Provider；只有显式兼容模式才覆盖为父仓库已安装的外部 Provider；
- 把 rex Workflow Stage 映射到 AIOS `agentRole`；
- 不重新描述阶段目标、步骤顺序或 Evidence Contract。

`workflow-policy.mjs` 删除 `balanced` / `wayfinder` 作为固定路由的逻辑。AIOS 仍决定 `direct | guarded | planned`，但 `requiredSkills` 只包含 rex 当前 Decision 对应的一个 Provider。Team/Harness 等宿主路由继续由 AIOS 管理。

`definitions.mjs` 只保留 AIOS Runtime 自身 Recipe（例如治理迁移和长循环），软件工程 Recipe 从 Adapter 投影获得。

## 迁移顺序

1. 用失败测试固定 Observation -> Fact、单 Capability 选择、Activation 和 Evidence 状态机；
2. 实现 rex 应用内核和 `software.implementation.execute`；
3. 用失败测试固定 AIOS 每轮只返回当前 Provider，并从 rex 读取软件 Recipe；
4. 实现 AIOS Adapter，移除 Router/Recipe 中的重复工作流；
5. 更新客户端说明和 Router Skill，使它们只说明所有权和宿主职责；
6. 运行 rex、AIOS 定向测试、脚本测试、安全扫描和变更影响检查。

## 非目标

- 不在 rex-harness 复制 ContextDB、RTK、Headroom、Team 或 Harness Runtime；
- 不让 Skill 自行根据关键词激活；
- 不把 Fast / Balanced / Deep 作为固定输入模式；
- 不引入第二个计划系统或新的运行时依赖；
- 不把 `harness-cli/scripts/lib/**` 私有模块导入 rex-harness。
