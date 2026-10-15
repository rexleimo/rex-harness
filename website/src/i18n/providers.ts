import type { Lang } from './ui';

// Provider catalog data for the hub + detail pages — every fact mirrors the kernel:
// src/providers/catalog.mjs + src/capabilities/*/capability.mjs
export interface ProviderStage {
  id: string;
  objective: Record<Lang, string>;
  evidence: string[];
}

export interface ProviderEntry {
  id: string;
  kind: 'skill' | 'agent' | 'baseline';
  capabilityId?: string;
  title: Record<Lang, string>;
  oneLine: Record<Lang, string>;
  summary: Record<Lang, string>;
  whenSelected: Record<Lang, string>;
  stages?: ProviderStage[];
  /** inner array = anyOf alternatives */
  evidence?: string[][];
}

export interface ProviderGroup {
  n: string;
  sectionId: Record<Lang, string>;
  label: Record<Lang, string>;
  desc: Record<Lang, string>;
  startWith: string;
  items: ProviderEntry[];
}

const ev = (...tokens: (string | string[])[]) => tokens.map((t) => (Array.isArray(t) ? t : [t]));

export const providerGroups: ProviderGroup[] = [
  {
    n: '01',
    sectionId: { en: 'orchestration-entry', zh: '编排入口' },
    label: { en: 'Orchestration', zh: '编排入口' },
    desc: {
      en: 'The entry point every agent loads first. Nothing else runs without it.',
      zh: '每个 Agent 首先加载的入口。没有它，其余 Provider 无从被发出。',
    },
    startWith: 'rex-workflow',
    items: [
      {
        id: 'rex-workflow',
        kind: 'skill',
        title: { en: 'The rex-workflow entry Skill', zh: 'rex-workflow 编排入口' },
        oneLine: {
          en: 'Start, resume and complete evidence-driven workflows through the rex-harness CLI; always returns exactly one current Command.',
          zh: '通过 rex-harness CLI 启动、续转或完成证据驱动工作流；每次只返回一条当前 Command。',
        },
        whenSelected: {
          en: 'Projected into every client by rex-harness init. The only Skill an agent loads before its first command.',
          zh: '由 rex-harness init 投影到每个客户端。Agent 在第一条命令前唯一需要加载的 Skill。',
        },
      },
    ],
  },
  {
    n: '02',
    sectionId: { en: 'requirements--decisions', zh: '需求与决策' },
    label: { en: 'Requirements & Decisions', zh: '需求与决策' },
    desc: {
      en: 'Align on what to build — and what was weighed and rejected — before anything exists.',
      zh: '在代码存在之前，先对齐要构建什么、权衡了什么、拒绝了什么。',
    },
    startWith: 'rex-requirements',
    items: [
      {
        id: 'rex-requirements',
        kind: 'skill',
        capabilityId: 'software.requirements.clarify',
        title: { en: 'The rex-requirements Skill', zh: 'rex-requirements 需求澄清' },
        oneLine: {
          en: 'Clarify observable behavior without creating a second implementation plan.',
          zh: '澄清可观测行为，但不产生第二份实施计划。',
        },
        whenSelected: {
          en: 'The runtime issues this first when a request is vague, underspecified, or open to multiple readings.',
          zh: '需求含糊、欠指定或存在多种解读时，运行时首先发出这条命令。',
        },
        evidence: ev(
          ['acceptance-criteria-recorded', 'assumptions-recorded'],
          ['non-goals-recorded', 'assumptions-recorded'],
          'first-slice-identified',
          'requirements-decision-recorded',
        ),
      },
      {
        id: 'rex-design',
        kind: 'skill',
        capabilityId: 'software.design.resolve',
        title: { en: 'The rex-design Skill', zh: 'rex-design 设计决策' },
        oneLine: {
          en: 'Resolve a consequential design choice before implementation commits to it.',
          zh: '在实施锁定方向之前，落地需要显式权衡的设计决策。',
        },
        whenSelected: {
          en: 'When a choice is consequential and must be made explicit before code exists.',
          zh: '决策影响深远、必须在代码存在前显式权衡时。',
        },
        evidence: ev('decision-recorded', 'tradeoffs-recorded', 'rejected-options-recorded'),
      },
      {
        id: 'rex-wayfinder',
        kind: 'skill',
        capabilityId: 'software.navigation.wayfind',
        title: { en: 'The rex-wayfinder Skill', zh: 'rex-wayfinder 决策寻路' },
        oneLine: {
          en: 'Map decisions when the destination is known but no executable next slice is visible.',
          zh: '目的地已知但看不到下一个可执行切片时，绘制决策地图。',
        },
        whenSelected: {
          en: 'When the path between goal and next work item is unclear and needs decision options priced.',
          zh: '目标与下一个工作项之间的路径不清晰、需要为决策选项标价时。',
        },
        evidence: ev('destination-recorded', 'decision-map-recorded', 'next-slice-identified'),
      },
    ],
  },
  {
    n: '03',
    sectionId: { en: 'planning--testing', zh: '计划与测试' },
    label: { en: 'Planning & Testing', zh: '计划与测试' },
    desc: {
      en: 'Sequence the work and pin the behavior contract tests must cover.',
      zh: '排出工作顺序，并钉住测试必须覆盖的行为契约。',
    },
    startWith: 'rex-planning',
    items: [
      {
        id: 'rex-planning',
        kind: 'skill',
        capabilityId: 'software.planning.sequence',
        title: { en: 'The rex-planning Skill', zh: 'rex-planning 实施计划' },
        oneLine: {
          en: 'Create an ordered work graph only when execution dependencies require one.',
          zh: '仅当执行依赖确实需要时，创建有序工作图。',
        },
        whenSelected: {
          en: 'When approved design work has real execution dependencies between bounded items.',
          zh: '已批准的设计工作在有条目间真实执行依赖时。',
        },
        evidence: ev('dependency-graph-recorded', 'step-verification-recorded'),
      },
      {
        id: 'rex-test-design',
        kind: 'skill',
        capabilityId: 'software.testing.design',
        title: { en: 'The rex-test-design Skill', zh: 'rex-test-design 测试契约' },
        oneLine: {
          en: 'Select public behavior seams and a minimal vertical test slice.',
          zh: '选择公共行为接缝（seam）与最小垂直测试切片。',
        },
        whenSelected: {
          en: 'Before implementation starts, to fix the behavior contract tests must cover.',
          zh: '实施开始前，钉住测试必须覆盖的行为契约。',
        },
        evidence: ev(
          'test-scope-contract-recorded',
          'acceptance-test-mapping-recorded',
          'test-seam-recorded',
          'testability-decision-recorded',
        ),
      },
      {
        id: 'rex-tdd',
        kind: 'skill',
        capabilityId: 'software.testing.tdd',
        title: { en: 'The rex-tdd Skill', zh: 'rex-tdd 基线 TDD' },
        oneLine: {
          en: 'Implement an ordinary behavior change through a scope-bound red-green-refactor cycle.',
          zh: '以范围绑定的 red-green-refactor 循环完成普通行为变更。',
        },
        whenSelected: {
          en: 'For ordinary behavior changes once the test-scope contract is confirmed.',
          zh: '测试范围契约已确认后的普通行为变更。',
        },
        evidence: ev(
          'failing-test-observed',
          'red-failure-reason-recorded',
          'passing-test-observed',
          'implementation-diff-recorded',
          'refactor-check-recorded',
          'test-diff-review-recorded',
        ),
      },
      {
        id: 'rex-strict-tdd',
        kind: 'skill',
        capabilityId: 'software.testing.strict-tdd',
        title: { en: 'The rex-strict-tdd Skill', zh: 'rex-strict-tdd 严格 TDD' },
        oneLine: {
          en: 'Apply strict red-green discipline to a high-risk behavior change or regression.',
          zh: '对高风险行为变更或回归施加严格 red-green 纪律。',
        },
        whenSelected: {
          en: 'Escalated from baseline TDD when a regression or high-risk boundary is confirmed; adds a test-strength proof on top.',
          zh: '回归或高风险边界确认后从基线 TDD 升级；在全部基础约束之上追加测试强度证明。',
        },
        evidence: ev(
          'failing-test-observed',
          'red-failure-reason-recorded',
          'passing-test-observed',
          'implementation-diff-recorded',
          'refactor-check-recorded',
          'test-strength-check-recorded',
          'test-diff-review-recorded',
        ),
      },
    ],
  },
  {
    n: '04',
    sectionId: { en: 'construction', zh: '构造' },
    label: { en: 'Construction', zh: '构造' },
    desc: {
      en: 'Turn approved plans into code without widening agreed behavior.',
      zh: '把已批准的计划变成代码，且不扩大既定行为。',
    },
    startWith: 'rex-implement',
    items: [
      {
        id: 'rex-implement',
        kind: 'skill',
        capabilityId: 'software.implementation.execute',
        title: { en: 'The rex-implement Skill', zh: 'rex-implement 有界实施' },
        oneLine: {
          en: 'Implement one approved vertical slice without widening its agreed behavior.',
          zh: '实现一条已批准的垂直切片，不扩大其既定行为。',
        },
        whenSelected: {
          en: 'For exactly one planned, approved slice; scope changes are reported, never absorbed.',
          zh: '只针对计划内、已批准的单条切片；范围变化需上报，绝不悄悄吸收。',
        },
        evidence: ev('implementation-diff-recorded', 'focused-tests-pass'),
      },
      {
        id: 'rex-minimal-construction',
        kind: 'skill',
        capabilityId: 'software.implementation.minimize',
        title: { en: 'The rex-minimal-construction Skill', zh: 'rex-minimal-construction 最小构造' },
        oneLine: {
          en: 'Choose the smallest correct response before adding a construct to the codebase.',
          zh: '在往代码库添加任何构造之前，选择最小充分响应。',
        },
        whenSelected: {
          en: 'Before new modules, abstractions or dependencies are proposed; runs the reuse ladder first.',
          zh: '新模块、新抽象或新依赖被提出之前；先走完复用阶梯再决定。',
        },
        evidence: ev('reuse-ladder-evaluated', 'minimal-option-recorded'),
      },
      {
        id: 'rex-refactor-hardening',
        kind: 'skill',
        capabilityId: 'software.testing.hardening',
        title: { en: 'The rex-refactor-hardening Skill', zh: 'rex-refactor-hardening 行为保持加固' },
        oneLine: {
          en: 'Safely harden behavior-preserving code through real scenario baselines and boundary verification.',
          zh: '通过真实场景基线与边界校验，安全加固保持行为的代码。',
        },
        whenSelected: {
          en: 'After a behavior-preserving hardening goal is set; observable behavior must survive unchanged.',
          zh: '确定保持行为的加固目标之后；可观测行为必须原样存活。',
        },
        evidence: ev(
          'baseline-scenario-observed',
          'hardening-diff-recorded',
          'affected-boundary-scenario-observed',
          'hardening-invariants-reviewed',
          'test-diff-review-recorded',
        ),
      },
      {
        id: 'rex-debug',
        kind: 'skill',
        capabilityId: 'software.debug.root-cause',
        title: { en: 'The rex-debug Skill', zh: 'rex-debug 根因调试' },
        oneLine: {
          en: 'Stop speculative edits and establish a root cause for an observed failure.',
          zh: '停止猜测式修改，为已观测到的失败建立根因。',
        },
        whenSelected: {
          en: 'Preempts the chain as soon as an observed failure appears: reproduce, observe, locate, then fix.',
          zh: '一旦出现已观测的失败立即抢占当前链路：复现、观测、定位，然后才是修复。',
        },
        evidence: ev('failure-reproduced', 'root-cause-evidenced', 'regression-check-recorded'),
      },
    ],
  },
  {
    n: '05',
    sectionId: { en: 'review--standards', zh: '审查与标准' },
    label: { en: 'Review & Standards', zh: '审查与标准' },
    desc: {
      en: 'Independent verification against repository standards, the spec, and risk domains.',
      zh: '对照仓库标准、来源规格与风险域的独立验证。',
    },
    startWith: 'rex-code-review',
    items: [
      {
        id: 'rex-code-review',
        kind: 'skill',
        capabilityId: 'software.review.standards-spec',
        title: { en: 'The rex-code-review Skill', zh: 'rex-code-review 标准与规格审查' },
        oneLine: {
          en: 'Review an implementation independently against repository standards and the originating spec.',
          zh: '独立对照仓库标准与来源规格审查一次实现。',
        },
        whenSelected: {
          en: 'After implementation evidence lands; the reviewer never edits, only records verdicts.',
          zh: '实施证据落地之后；审查者从不改码，只记录结论。',
        },
        evidence: ev('standards-review-recorded', 'spec-review-recorded'),
      },
      {
        id: 'rex-specialist-review',
        kind: 'agent',
        capabilityId: 'software.review.specialist',
        title: { en: 'The specialist-reviewer agent', zh: '风险域专家评审 Agent' },
        oneLine: {
          en: 'Request one evidence-backed specialist review for an identified risk domain.',
          zh: '为已识别的风险域请求一次有证据支撑的专家评审。',
        },
        whenSelected: {
          en: 'Resolved inside the host by risk domain (security, React, TypeScript) from the same Catalog; the only kind: agent binding.',
          zh: '由宿主按风险域（security、React、TypeScript）从同一 Catalog 解析；目录中唯一的 kind: agent 绑定。',
        },
        evidence: ev('specialist-scope-recorded', 'specialist-verdict-recorded'),
      },
      {
        id: 'rex-engineering-standards',
        kind: 'baseline',
        title: { en: 'The engineering-standards baseline', zh: '工程质量基线' },
        oneLine: {
          en: 'Shared quality baseline for all code-producing work: clean architecture boundaries, deep modules, test guarantees.',
          zh: '所有产码工作的共享质量基线：Clean Architecture 边界、深层模块、测试担保。',
        },
        whenSelected: {
          en: 'Never dispatched as a command — every code-producing provider loads it as a constraint.',
          zh: '从不作为命令发出——每个产码 Provider 都将其作为约束加载。',
        },
      },
    ],
  },
];

export const hubCopy = {
  eyebrow: { en: 'REFERENCE · PROVIDER CATALOG', zh: '参考 · PROVIDER 目录' },
  intro: {
    en: 'Every Provider shipped with rex-harness: what it owns, when the runtime issues its command, and the exact evidence tokens it must return. Capability IDs are provider-agnostic; providers never self-trigger.',
    zh: 'rex-harness 自带的每个 Provider：负责什么、运行时何时发出它的命令、必须交回哪些 Evidence 令牌。Capability ID 与 Provider 无关；Provider 从不自我触发。',
  },
  stats: {
    en: '15 bindings · 14 bundled skills + 1 agent · projected by rex-harness init',
    zh: '15 条绑定 · 14 个内置 Skill + 1 个 Agent · 由 rex-harness init 投影',
  },
  installLabel: { en: 'PROJECT THE CATALOG INTO YOUR AGENT', zh: '把目录投影到你的 AGENT' },
  installCmd: 'rex-harness init --client codex',
  installNote: {
    en: 'Works with any client: codex · claude · gemini · opencode · hermes · grok · pi · zcode',
    zh: '支持全部客户端：codex · claude · gemini · opencode · hermes · grok · pi · zcode',
  },
  startWith: { en: 'Start with', zh: '入口' },
  whenLabel: { en: 'When the runtime issues it', zh: '运行时何时发出' },
  evidenceLabel: { en: 'Required evidence', zh: '必须交回的 Evidence' },
  capabilityLabel: { en: 'Capability', zh: 'Capability' },
  kindLabels: { skill: 'skill', agent: 'agent', baseline: 'baseline' },
  chainTitle: { en: 'How they chain', zh: '如何串联' },
  chainNote: {
    en: 'The runtime never pre-installs the whole chain: each link is issued only after the previous stage’s evidence lands.',
    zh: '运行时从不预装整条链：每一环只在上一阶段证据落地后才被发出。',
  },
  conceptTitle: { en: 'What is a Provider?', zh: '什么是 Provider？' },
  concepts: [
    {
      h: { en: 'The rule', zh: '规则' },
      p: {
        en: 'A Provider never self-triggers. It executes exactly one current Command issued by the kernel, returns Evidence, and stops.',
        zh: 'Provider 永不自我触发。它只执行内核发出的一条当前 Command，交回 Evidence 后即停止。',
      },
    },
    {
      h: { en: 'The contract', zh: '契约' },
      p: {
        en: 'Capabilities are addressed by stable software.* IDs. Provider names never enter host contracts, so swapping a bundled skill needs no host change.',
        zh: 'Capability 以稳定的 software.* ID 寻址。Provider 名称不进入宿主契约，替换内置 Skill 无需修改宿主。',
      },
    },
    {
      h: { en: 'Why it composes', zh: '为何能组合' },
      p: {
        en: 'Every accepted evidence token advances the workflow and rotates the one-shot command token — the chain is issued step by step, never wired upfront.',
        zh: '每条被接受的 Evidence 都会推进工作流并轮换一次性命令令牌——链条逐环发出，从不预先接线。',
      },
    },
  ],
};

// ---- Detail-page data (stages + summaries), merged with the catalog by id ----

export const evidenceGlossary: Record<string, Record<Lang, string>> = {
  'acceptance-criteria-recorded': { en: 'Observable acceptance criteria written down and confirmed.', zh: '可观测的验收标准已落档并确认。' },
  'assumptions-recorded': { en: 'Open items explicitly parked as named assumptions.', zh: '未决项已显式记录为具名假设。' },
  'non-goals-recorded': { en: 'Out-of-scope items recorded so scope cannot drift silently.', zh: '非目标已记录，范围不会悄悄漂移。' },
  'first-slice-identified': { en: 'The first deliverable vertical slice is named.', zh: '第一个可交付垂直切片已指明。' },
  'requirements-decision-recorded': { en: 'The clarifying decision itself is on record.', zh: '澄清所依据的决策已入档。' },
  'decision-recorded': { en: 'The chosen design option and its rationale.', zh: '选定的设计选项及其理由。' },
  'tradeoffs-recorded': { en: 'The weighed trade-offs are explicit, not tacit.', zh: '权衡过程显式落档，而非心照不宣。' },
  'rejected-options-recorded': { en: 'Rejected alternatives kept for future reference.', zh: '被拒绝的方案保留备查。' },
  'destination-recorded': { en: 'The goal of the wayfinding trip is written down.', zh: '本次寻路要到达的目的地已记录。' },
  'decision-map-recorded': { en: 'Open decisions mapped with dependencies and costs.', zh: '决策地图已绘制：依赖、选项与代价。' },
  'next-slice-identified': { en: 'An executable next slice emerged from the map.', zh: '从地图中出现了一个可执行的下一切片。' },
  'dependency-graph-recorded': { en: 'Work items ordered by real execution dependencies.', zh: '工作项按真实执行依赖排序成图。' },
  'step-verification-recorded': { en: 'Every step has its verification evidence assigned.', zh: '每一步都指定了验证证据。' },
  'test-scope-contract-recorded': { en: 'The behavior boundary tests must cover is fixed.', zh: '测试必须覆盖的行为边界已钉住。' },
  'acceptance-test-mapping-recorded': { en: 'Acceptance behaviors mapped onto tests.', zh: '验收行为到测试的映射已完成。' },
  'test-seam-recorded': { en: 'Public seams chosen as the test surface.', zh: '公共接缝已选定为测试面。' },
  'testability-decision-recorded': { en: 'Honest verdict: does a real RED exist?', zh: '可测性结论：是否存在诚实的 RED。' },
  'failing-test-observed': { en: 'A red test run was actually observed, not claimed.', zh: '失败测试被真实观测到，而非口头声称。' },
  'red-failure-reason-recorded': { en: 'The failure reason matches the target behavior.', zh: '失败原因与目标行为一致并已记录。' },
  'passing-test-observed': { en: 'The target test now passes.', zh: '目标测试现已通过。' },
  'implementation-diff-recorded': { en: 'A bounded implementation diff is on record.', zh: '有边界的实现差异已入档。' },
  'refactor-check-recorded': { en: 'Tests stayed green through the refactor.', zh: '重构全程保持测试通过。' },
  'test-diff-review-recorded': { en: 'Test diff reviewed: no weakened behavior constraints.', zh: '测试差异已审查：未弱化行为约束。' },
  'test-strength-check-recorded': { en: 'Targeted probes prove the test really blocks the defect.', zh: '定向探针证明测试确实能阻止目标缺陷。' },
  'focused-tests-pass': { en: 'The slice’s focused tests pass.', zh: '本切片的聚焦测试通过。' },
  'reuse-ladder-evaluated': { en: 'Existing code, then config, then new code — in that order.', zh: '先复用、再配置、后新码——按阶梯顺序评估。' },
  'minimal-option-recorded': { en: 'The smallest sufficient construct is chosen and justified.', zh: '最小充分构造已选定并给出理由。' },
  'baseline-scenario-observed': { en: 'Pre-change behavior captured via real public scenarios.', zh: '变更前行为已用真实公共场景固定。' },
  'hardening-diff-recorded': { en: 'The hardening diff itself is bounded and recorded.', zh: '加固差异本身有界并已入档。' },
  'affected-boundary-scenario-observed': { en: 'Affected boundaries re-verified against the baseline.', zh: '受影响边界已对照基线复验。' },
  'hardening-invariants-reviewed': { en: 'Side-effect paths and invariants reviewed, no test-only escapes.', zh: '副作用路径与不变量已审查，无测试专用后门。' },
  'failure-reproduced': { en: 'The reported failure reproduces deterministically.', zh: '所报失败可稳定复现。' },
  'root-cause-evidenced': { en: 'Root cause established with observations, not guesses.', zh: '根因由观测确立，而非猜测。' },
  'regression-check-recorded': { en: 'A check that would have caught the bug now exists.', zh: '能防住该回归的检查已定义。' },
  'standards-review-recorded': { en: 'Diff reviewed against repository standards.', zh: '对照仓库标准的审查已完成。' },
  'spec-review-recorded': { en: 'Diff reviewed against the originating spec.', zh: '对照来源规格的审查已完成。' },
  'specialist-scope-recorded': { en: 'The risk domain under review is explicitly scoped.', zh: '本次评审的风险域已显式定界。' },
  'specialist-verdict-recorded': { en: 'The specialist verdict is on record with evidence.', zh: '专家结论连同证据已入档。' },
};

const st = (id: string, en: string, zh: string, evidence: string[]): ProviderStage => ({ id, objective: { en, zh }, evidence });

export const providerDetails: Record<string, { summary: Record<Lang, string>; stages?: ProviderStage[] }> = {
  'rex-workflow': {
    summary: {
      en: 'The orchestration entry skill. It teaches an agent to talk to the rex-harness kernel through its CLI: start a workflow for a work item, obey the single current command returned, submit evidence, and resume after interruption. Every other provider in this catalog is reached through commands issued via this skill.',
      zh: '编排入口 Skill。它教会 Agent 通过 rex-harness CLI 与内核对话：为 work item 启动工作流、执行返回的当前命令、提交证据、中断后续转。目录中其余 Provider 都经由这个 Skill 发出的命令抵达。',
    },
  },
  'rex-requirements': {
    summary: {
      en: 'Turns a vague request into observable, agreed behavior before implementation starts. It clarifies acceptance criteria, non-goals and the first deliverable slice — and records open items as named assumptions instead of letting the agent silently guess. It deliberately does not produce a second implementation plan.',
      zh: '在实施开始前，把含糊请求变成可观测、已共识的行为。它澄清验收标准、非目标与第一个可交付切片——未决项记录为具名假设，而不是让 Agent 悄悄猜。它刻意不产出第二份实施计划。',
    },
    stages: [st('clarify', 'Clarify observable behavior, non-goals and the first deliverable slice; unresolved items may converge as recorded assumptions.', '澄清可观测行为、非目标与第一个可交付切片；未决项可记录为假设收敛。', ['acceptance-criteria-recorded', 'assumptions-recorded', 'non-goals-recorded', 'first-slice-identified', 'requirements-decision-recorded'])],
  },
  'rex-design': {
    summary: {
      en: 'Lands a consequential design choice before code exists — the kind that is expensive to reverse. The decision, its trade-offs and the rejected options are all recorded, so future readers know why the codebase looks the way it does.',
      zh: '在代码存在之前落地需要显式权衡、事后难以逆转的设计决策。决策本身、权衡过程与被拒绝的方案全部入档，让后来者知道代码库为何是这副样子。',
    },
    stages: [st('resolve', 'Compare consequential design options and record an executable choice.', '比较关键设计选项并记录可执行的选择。', ['decision-recorded', 'tradeoffs-recorded', 'rejected-options-recorded'])],
  },
  'rex-wayfinder': {
    summary: {
      en: 'For the state where the destination is known but no executable next slice is visible. It charts the open decisions — dependencies, options, cost of getting each wrong — until a concrete next step falls out of the map.',
      zh: '应对"目的地已知、却看不到下一个可执行切片"的状态。它绘制未决地图——依赖、选项、每个决策做错的代价——直到一个具体的下一步从地图中浮现。',
    },
    stages: [st('map', 'Record the destination and key decisions until an executable next slice appears.', '记录目标和关键决策，直到出现一个可执行的下一切片。', ['destination-recorded', 'decision-map-recorded', 'next-slice-identified'])],
  },
  'rex-planning': {
    summary: {
      en: 'Creates an ordered work graph only when execution dependencies genuinely require one — each step bounded, each step carrying its own verification evidence. No ceremony for trivial work.',
      zh: '仅当执行确实存在条目间依赖时才创建有序工作图——每个工作项有界，每一步自带验证证据。不为琐碎工作制造仪式感。',
    },
    stages: [st('sequence', 'Build a dependency-ordered execution graph and assign verification evidence to every step.', '建立有依赖关系的执行图，并为每一步指定验证证据。', ['dependency-graph-recorded', 'step-verification-recorded'])],
  },
  'rex-test-design': {
    summary: {
      en: 'Pins the behavior contract tests must cover before any implementation: user goals, non-goals, public seams, and a minimal vertical test slice. It also makes the honest testability call — if no real RED exists, the work diverts to hardening verification instead of fake tests.',
      zh: '在任何实施之前钉住测试必须覆盖的行为契约：用户目标、非目标、公共接缝与最小垂直测试切片。它同时给出诚实的可测性结论——若不存在真实的 RED，工作转入加固验证而不是伪造测试。',
    },
    stages: [
      st('design-tests', 'Confirm goals, non-goals and test boundaries; map acceptance behaviors onto public test seams.', '确认用户目标、非目标和测试边界，把验收行为映射到公共测试缝。', ['test-scope-contract-recorded', 'acceptance-test-mapping-recorded', 'test-seam-recorded']),
      st('decide-testability', 'From real scenario baselines, decide honestly whether a real RED exists; without behavioral difference divert to hardening; when acceptance is unobservable, name the blocker.', '基于真实公共场景基线，明确是否存在诚实的 RED；没有行为差异时转入加固验证，验收不可观察时明确阻塞。', ['testability-decision-recorded']),
    ],
  },
  'rex-tdd': {
    summary: {
      en: 'The scope-bound baseline red-green-refactor cycle for ordinary behavior changes. The test-scope contract fixed by rex-test-design is the boundary of this cycle: the agent may not widen or narrow it from implementation pressure, and must report back when goals change.',
      zh: '普通行为变更的范围绑定基线 red-green-refactor 循环。rex-test-design 钉住的测试范围契约是本周期边界：Agent 不得因实现压力自行扩大或缩小测试范围，目标变化时必须上报而不是就地改契约。',
    },
    stages: [
      st('red', 'Run a failing test mapped to the confirmed scope and record a failure reason consistent with the target behavior.', '运行映射到已确认测试范围的失败测试，并记录与目标行为一致的失败原因。', ['failing-test-observed', 'red-failure-reason-recorded']),
      st('green', 'Implement the minimal change that makes the target test pass; record a bounded implementation diff.', '实施使目标测试通过的最小代码变更，并记录有边界的实现差异。', ['passing-test-observed', 'implementation-diff-recorded']),
      st('refactor', 'Keep tests green, tidy the implementation, and review that the test diff has not weakened behavior constraints.', '保持测试通过，整理实现并审查测试差异没有弱化用户行为约束。', ['refactor-check-recorded', 'test-diff-review-recorded']),
    ],
  },
  'rex-strict-tdd': {
    summary: {
      en: 'The escalated path: same red-green-refactor discipline plus proof that the tests actually block the target defect. Used when a regression or high-risk boundary is confirmed — a passing test is not enough, its strength must be demonstrated.',
      zh: '升级路径：在基础 TDD 的全部约束之上，额外证明测试真的能阻止目标缺陷。用于回归或高风险边界被确认后——测试通过不算完，强度必须被出示。',
    },
    stages: [
      st('red', 'Run a failing test mapped to the confirmed scope and record a failure reason consistent with the target behavior.', '运行映射到已确认测试范围的失败测试，并记录与目标行为一致的失败原因。', ['failing-test-observed', 'red-failure-reason-recorded']),
      st('green', 'Implement the minimal change that makes the target test pass; record a bounded implementation diff.', '实施使目标测试通过的最小代码变更，并记录有边界的实现差异。', ['passing-test-observed', 'implementation-diff-recorded']),
      st('refactor', 'Tidy the implementation, run targeted test-strength probes, and review the test diff for weakened constraints.', '整理实现，执行定向测试强度探针，并审查测试差异没有弱化用户行为约束。', ['refactor-check-recorded', 'test-strength-check-recorded', 'test-diff-review-recorded']),
    ],
  },
  'rex-implement': {
    summary: {
      en: 'Executes exactly one approved vertical slice without widening its agreed behavior. Scope changes are reported to the kernel, never absorbed silently; the deliverable is a bounded diff plus focused test results.',
      zh: '精确执行一条已批准的垂直切片，不扩大既定行为。范围变化上报内核处理，绝不悄悄吸收；交付物是有边界的差异加上聚焦测试结果。',
    },
    stages: [st('implement', 'Implement one approved vertical slice and run focused verification.', '实现一个已经批准的纵向切片，并运行聚焦验证。', ['implementation-diff-recorded', 'focused-tests-pass'])],
  },
  'rex-minimal-construction': {
    summary: {
      en: 'The gate before adding any construct to the codebase: walk the reuse ladder first — existing code, then configuration, then new code — and record the smallest option that actually satisfies the goal.',
      zh: '向代码库添加任何构造之前的闸门：先走完复用阶梯——既有代码、配置、最后才是新代码——并记录真正满足目标的最小选项。',
    },
    stages: [st('minimize', 'Compare options along the reuse ladder; record the minimal implementation that satisfies the goal.', '按复用阶梯比较选项，并记录满足目标的最小实现方式。', ['reuse-ladder-evaluated', 'minimal-option-recorded'])],
  },
  'rex-refactor-hardening': {
    summary: {
      en: 'Behavior-preserving hardening with real scenario baselines: capture the before-state through public scenarios, apply a bounded hardening diff, re-verify affected boundaries, and review that no invariant was weakened or test-only escape hatch introduced.',
      zh: '以真实场景基线护航的行为保持加固：用公共场景固定变更前基线，施加有边界的加固差异，复验受影响边界，并审查没有弱化不变量、没有引入测试专用后门。',
    },
    stages: [
      st('baseline', 'Run real public scenarios in an isolated, cleanable environment; record the pre-change baseline and execution receipts.', '在独立、可清理环境中运行真实公共场景，记录变更前基线及执行回执。', ['baseline-scenario-observed']),
      st('harden', 'Apply bounded hardening and verify behavior has not regressed using affected-boundary scenarios.', '实施受限加固，并用受影响边界的真实场景验证行为没有回退。', ['hardening-diff-recorded', 'affected-boundary-scenario-observed']),
      st('verify-invariants', 'Review side-effect paths, test diffs and invariants; confirm no weakened constraints or test-only escapes.', '审查副作用路径、测试差异和不变量，确认没有弱化行为约束或引入测试专用出口。', ['hardening-invariants-reviewed', 'test-diff-review-recorded']),
    ],
  },
  'rex-debug': {
    summary: {
      en: 'Stops speculative edits the moment a failure is observed: reproduce, observe, locate, and only then fix. The output is not just a patch — it is a reproduction, an evidenced root cause, and a regression check that would have caught the bug.',
      zh: '观测到失败的那一刻就阻止猜测式修改：复现、观测、定位，然后才是修复。产出不只是一个补丁——而是复现记录、有证据的根因，以及一条本可以拦住这个 bug 的回归检查。',
    },
    stages: [st('diagnose', 'Reproduce the failure, locate the root cause, and define a check that prevents the regression.', '复现失败、定位根因并定义能够防止回归的检查。', ['failure-reproduced', 'root-cause-evidenced', 'regression-check-recorded'])],
  },
  'rex-code-review': {
    summary: {
      en: 'Independent post-implementation review on two axes: repository standards and the originating spec. The reviewer records verdicts against the bounded diff — it never edits the code itself.',
      zh: '实施后的独立双轴审查：仓库标准与来源规格。审查者针对有界差异记录结论——从不亲自改码。',
    },
    stages: [st('review', 'Independently review the bounded diff against repository standards and the originating spec.', '独立对照仓库规范和原始规格审查有边界的代码差异。', ['standards-review-recorded', 'spec-review-recorded'])],
  },
  'rex-specialist-review': {
    summary: {
      en: 'The only kind: agent binding in the catalog. When a risk domain is identified — security, React, TypeScript — the host resolves a specialist reviewer from the same catalog and requests one scoped, evidence-backed review.',
      zh: '目录中唯一的 kind: agent 绑定。当识别出风险域（security、React、TypeScript）时，宿主从同一 Catalog 解析专家评审 Agent，并请求一次有范围、有证据的专项审查。',
    },
    stages: [st('review-risk', 'Run one scoped, evidence-backed specialist review for the identified risk domain.', '针对已识别的风险领域执行一次有范围、有证据的专项审查。', ['specialist-scope-recorded', 'specialist-verdict-recorded'])],
  },
  'rex-engineering-standards': {
    summary: {
      en: 'Not a dispatched command but the shared quality baseline every code-producing provider loads: clean architecture boundaries, deep modules, clean-code naming, test guarantees, and tool-chain discipline. It is what "reviewed against repository standards" actually means.',
      zh: '它不是被发出的命令，而是所有产码 Provider 加载的共享质量基线：Clean Architecture 边界、深层模块、Clean Code 命名、测试担保与工具链纪律。"对照仓库标准审查"指的就是它。',
    },
  },
};

export function getProvider(id: string): { entry: ProviderEntry; group: ProviderGroup; detail: (typeof providerDetails)[string] } | undefined {
  for (const group of providerGroups) {
    const entry = group.items.find((p) => p.id === id);
    if (entry) {
      const detail = providerDetails[id] ?? { summary: entry.oneLine };
      return { entry, group, detail };
    }
  }
  return undefined;
}

export function allProviders(): { entry: ProviderEntry; group: ProviderGroup }[] {
  return providerGroups.flatMap((g) => g.items.map((entry) => ({ entry, group: g })));
}

// Chain position for prev/next on detail pages (execution order, not alphabetical)
export const chainOrder = [
  'rex-workflow',
  'rex-requirements',
  'rex-design',
  'rex-wayfinder',
  'rex-planning',
  'rex-test-design',
  'rex-tdd',
  'rex-strict-tdd',
  'rex-implement',
  'rex-minimal-construction',
  'rex-refactor-hardening',
  'rex-debug',
  'rex-code-review',
  'rex-specialist-review',
  'rex-engineering-standards',
];

export const hubLabels = {
  detailWhen: { en: 'When the runtime issues it', zh: '运行时何时发出' },
  stagesTitle: { en: 'Recipe stages', zh: 'Recipe 阶段' },
  evidenceTitle: { en: 'Required evidence', zh: '必须交回的 Evidence' },
  evidenceNote: { en: 'Each token below is a fact the kernel accepts as typed evidence — until every required token lands, the workflow does not advance.', zh: '下列每个令牌都是内核接受的类型化事实证据——在所有必需令牌落地前，工作流不会推进。' },
  chainTitle: { en: 'Chain position', zh: '链路位置' },
  sourceTitle: { en: 'Source', zh: '来源' },
  sourceNote: {
    en: 'Bundled with rex-harness and projected into your agent by rex-harness init. Capability IDs are stable host contracts; provider names never enter them.',
    zh: '随 rex-harness 内置，由 rex-harness init 投影到你的 Agent。Capability ID 是稳定的宿主契约；Provider 名称不进入契约。',
  },
  backToCatalog: { en: 'Back to Provider catalog', zh: '返回 Provider 目录' },
  relatedTitle: { en: 'Related providers', zh: '相关 Provider' },
  stageEvidence: { en: 'Evidence', zh: '证据' },
};
