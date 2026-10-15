import type { Lang } from './ui';

export interface Section {
  id: string;
  title: string;
  /** trusted, authored HTML */
  html: string;
}

const en: Section[] = [
  {
    id: 'what-it-does',
    title: 'What it does',
    html: `<p class="ah-prose-p"><code class="ah-code-inline">rex-harness</code> is a standalone software-engineering control plane for coding agents. It reads your task and the agent's structured <strong class="ah-prose-strong">Observations</strong>, derives <strong class="ah-prose-strong">Facts</strong>, selects exactly one <strong class="ah-prose-strong">Capability</strong> at a time, emits a typed <strong class="ah-prose-strong">Provider Command</strong>, and advances the workflow only when matching <strong class="ah-prose-strong">Evidence</strong> is submitted.</p>
<p class="ah-prose-p">It is <strong class="ah-prose-strong">stateful and fail-closed</strong>. Every activation lives in <code class="ah-code-inline">.rex-harness/</code> inside your project, every accepted piece of evidence rotates a one-time command token, and stale or placeholder evidence is rejected instead of silently advancing the run.</p>`,
  },
  {
    id: 'when-to-reach-for-it',
    title: 'When to reach for it',
    html: `<p class="ah-prose-p">Reach for <code class="ah-code-inline">rex-harness</code> when a task outgrows a single prompt: refactors with coupled changes, releases that must be verified, overnight runs that must resume, or any work where "the agent says it is done" is not good enough. It runs on top of the agent you already use — Codex, Claude Code, Gemini CLI, OpenCode, Hermes, Grok, Pi, and ZCode.</p>
<p class="ah-prose-p">You do <strong class="ah-prose-strong">not</strong> need AIOS, ContextDB, an MCP server, or a resident daemon. The standalone kernel is the supported core; the host only adds enhancements. See <a class="ah-prose-a" href="./docs/getting-started/">Getting started</a> for the 30-second path.</p>`,
  },
  {
    id: 'how-the-loop-works',
    title: 'How the loop works',
    html: `<p class="ah-prose-p">One workflow, one current Command. The loop is always the same four moves:</p>
<ul class="ah-bullets">
<li><strong class="ah-prose-strong">Fact</strong> — what is observably true about the work item, derived from typed observations.</li>
<li><strong class="ah-prose-strong">Capability</strong> — one of requirements, design, planning, tdd, strict-tdd, debug, minimal-construction, implementation, code review, specialist review, or wayfinding. Exactly one is selected per turn.</li>
<li><strong class="ah-prose-strong">Command</strong> — a typed, one-shot instruction (<code class="ah-code-inline">rex.cli.workflow-command.v1</code>) naming the provider, the stage goal, the evidence contract, and a rotating <code class="ah-code-inline">commandToken</code>.</li>
<li><strong class="ah-prose-strong">Evidence</strong> — the artifact or verification result the command demanded. Accepted → rotate token, advance. Rejected → blocked with a reason.</li>
</ul>
<div class="group relative w-full my-5"><pre class="bg-card! text-xs! sm:text-sm! border-border overflow-x-auto rounded-md border px-3 py-2.5 font-mono"><code>$ rex-harness start --work-item checkout \\
    --message "Clarify acceptance criteria before implementing checkout."
$ rex-harness status --work-item checkout
$ rex-harness evidence \\
    --activation &lt;current-activation-id&gt; \\
    --command-token &lt;current-token&gt; \\
    --evidence acceptance-criteria-recorded=artifact:requirements
$ rex-harness resume --work-item checkout</code></pre></div>
<p class="ah-prose-p">By default the CLI returns the compact command object — current state, provider, <code class="ah-code-inline">instructionsRef</code>, stage goal, evidence contract, and the one-time token. Add <code class="ah-code-inline">--full</code> only when you want the complete workflow result for diagnostics or audit. Full reference: <a class="ah-prose-a" href="./docs/cli-reference/">CLI commands</a>.</p>`,
  },
  {
    id: 'running-it-standalone',
    title: 'Running it standalone',
    html: `<p class="ah-prose-p">State stays project-local and auditable:</p>
<ul class="ah-bullets">
<li><code class="ah-code-inline">.rex-harness/workflows/</code> — canonical workflow activations and the work-item index.</li>
<li><code class="ah-code-inline">.rex-harness/activations/</code> — a convenience projection of the current capability.</li>
<li><code class="ah-code-inline">.rex-harness/evidence/</code> — an append-only NDJSON evidence journal.</li>
</ul>
<p class="ah-prose-p">Use <code class="ah-code-inline">--root &lt;project-root&gt;</code> to target another project. State reads and writes fail closed: corrupted state, mismatched evidence types, or references without a protocol prefix stop the run rather than paper over it. Once evidence is accepted the token rotates and the old token is immediately invalid — replays cannot happen. The contract is documented in <a class="ah-prose-a" href="./docs/capability-lifecycle/">Capability lifecycle</a>.</p>`,
  },
  {
    id: 'connecting-your-agent',
    title: 'Connecting your agent',
    html: `<p class="ah-prose-p">Project the <code class="ah-code-inline">rex-workflow</code> orchestration entry and the currently executable built-in provider skills into your client's standard discovery directory:</p>
<div class="group relative w-full my-5"><pre class="bg-card! text-xs! sm:text-sm! border-border overflow-x-auto rounded-md border px-3 py-2.5 font-mono"><code>rex-harness init --client codex
rex-harness init --client claude
rex-harness init --client gemini
rex-harness init --client opencode</code></pre></div>
<p class="ah-prose-p">The agent then loads one provider at a time — the entry skill reads the current Command, executes only that provider's goal, and submits real evidence. Full history stays in <code class="ah-code-inline">.rex-harness/</code>, never in the model's memory. Browse all providers in the <a class="ah-prose-a" href="./docs/providers/">Provider catalog</a>.</p>`,
  },
  {
    id: 'common-questions',
    title: 'Common questions',
    html: `<p class="ah-prose-p"><strong class="ah-prose-strong">Do I need AIOS to run it?</strong> No. The standalone kernel owns Facts, Capabilities, Recipes, Activations, Commands, and the Evidence contract. AIOS adds model execution, ContextDB, teams, long-run recovery, and governance on top — see <a class="ah-prose-a" href="./docs/architecture/">Architecture</a>.</p>
<p class="ah-prose-p"><strong class="ah-prose-strong">Why one command at a time?</strong> Because "do everything" is how agents drift. A single typed command keeps the provider goal bounded, the evidence checkable, and the resume point exact.</p>
<p class="ah-prose-p"><strong class="ah-prose-strong">What counts as evidence?</strong> Anything the current evidence contract names — a recorded artifact, a passing test, a verified behavior. References must carry a protocol prefix; placeholders (<code class="ah-code-inline">TODO</code>, <code class="ah-code-inline">TBD</code>) are rejected. The rules live in <a class="ah-prose-a" href="./docs/provider-contract/">Provider contract</a>.</p>
<p class="ah-prose-p"><strong class="ah-prose-strong">Can I audit a finished run?</strong> Yes. The evidence journal is append-only, and <code class="ah-code-inline">--full</code> reconstructs the complete workflow object at any point.</p>`,
  },
  {
    id: 'where-it-fits',
    title: 'Where it fits',
    html: `<p class="ah-prose-p"><code class="ah-code-inline">rex-harness</code> is the workflow kernel of the <a class="ah-prose-a" href="./docs/workflow-ownership/">AIOS control plane</a> — a local-first layer that gives coding agents cross-session memory, coordination, and verifiable evidence. Keep your client; the harness adds the control loop it is missing. Everything runs on your machine, and nothing leaves it.</p>`,
  },
];

const zh: Section[] = [
  {
    id: 'what-it-does',
    title: '它做什么',
    html: `<p class="ah-prose-p"><code class="ah-code-inline">rex-harness</code> 是一个可独立运行的软件工程控制面。它读取 Coding Agent 的任务和结构化 <strong class="ah-prose-strong">Observation</strong>，推导 <strong class="ah-prose-strong">Fact</strong>，一次只选择一个 <strong class="ah-prose-strong">Capability</strong>，发出类型化的 <strong class="ah-prose-strong">Provider Command</strong>，并用类型化 <strong class="ah-prose-strong">Evidence</strong> 决定阻塞、续转或完成。</p>
<p class="ah-prose-p">它是<strong class="ah-prose-strong">有状态、fail-closed</strong> 的。每条 Activation 都保存在项目内的 <code class="ah-code-inline">.rex-harness/</code>；每条被接受的证据都会轮换一次性命令令牌；过期或占位符证据会被拒绝，而不是悄悄推进。</p>`,
  },
  {
    id: 'when-to-reach-for-it',
    title: '什么时候用它',
    html: `<p class="ah-prose-p">当任务超出一次提示词的能力时就用它：有耦合变更的重构、必须验证的发布、需要断点恢复的过夜长任务，以及任何"Agent 说做完了"不算数的场景。它运行在你已有的 Agent 之上 —— Codex、Claude Code、Gemini CLI、OpenCode、Hermes、Grok、Pi、ZCode。</p>
<p class="ah-prose-p">你<strong class="ah-prose-strong">不需要</strong> AIOS、ContextDB、MCP Server 或常驻服务。独立内核就是受支持的完整路径；宿主只是增强。30 秒上手见<a class="ah-prose-a" href="./docs/getting-started/">快速上手</a>。</p>`,
  },
  {
    id: 'how-the-loop-works',
    title: '循环如何运转',
    html: `<p class="ah-prose-p">一个工作流，同一时刻只有一条当前 Command。循环永远是同样的四步：</p>
<ul class="ah-bullets">
<li><strong class="ah-prose-strong">Fact</strong> —— 从类型化 Observation 推导出的、关于这个 work item 可观测为真的事实。</li>
<li><strong class="ah-prose-strong">Capability</strong> —— requirements、design、planning、tdd、strict-tdd、debug、minimal-construction、implement、code review、专项审查、wayfinding 之中，每轮恰好选择一个。</li>
<li><strong class="ah-prose-strong">Command</strong> —— 一条类型化的一次性指令（<code class="ah-code-inline">rex.cli.workflow-command.v1</code>），声明 Provider、阶段目标、Evidence Contract 和会轮换的 <code class="ah-code-inline">commandToken</code>。</li>
<li><strong class="ah-prose-strong">Evidence</strong> —— 命令要求的产物或验证结果。接受 → 轮换令牌并推进；拒绝 → 带原因阻塞。</li>
</ul>
<div class="group relative w-full my-5"><pre class="bg-card! text-xs! sm:text-sm! border-border overflow-x-auto rounded-md border px-3 py-2.5 font-mono"><code>$ rex-harness start --work-item checkout \\
    --message "实现结账前先澄清验收标准。"
$ rex-harness status --work-item checkout
$ rex-harness evidence \\
    --activation &lt;当前激活 id&gt; \\
    --command-token &lt;当前令牌&gt; \\
    --evidence acceptance-criteria-recorded=artifact:requirements
$ rex-harness resume --work-item checkout</code></pre></div>
<p class="ah-prose-p">默认情况下 CLI 返回 compact 命令对象 —— 当前状态、Provider、<code class="ah-code-inline">instructionsRef</code>、阶段目标、Evidence Contract 和一次性令牌。需要诊断或审计时才加 <code class="ah-code-inline">--full</code>。完整参考见<a class="ah-prose-a" href="./docs/cli-reference/">CLI 命令</a>。</p>`,
  },
  {
    id: 'running-it-standalone',
    title: '独立运行',
    html: `<p class="ah-prose-p">状态保存在项目本地，全程可审计：</p>
<ul class="ah-bullets">
<li><code class="ah-code-inline">.rex-harness/workflows/</code> —— 规范 Workflow Activation 与 work-item 索引。</li>
<li><code class="ah-code-inline">.rex-harness/activations/</code> —— 当前 Capability 的便捷投影。</li>
<li><code class="ah-code-inline">.rex-harness/evidence/</code> —— 只追加的 NDJSON Evidence Journal。</li>
</ul>
<p class="ah-prose-p">用 <code class="ah-code-inline">--root &lt;project-root&gt;</code> 指定目标项目。状态读写 fail-closed：状态损坏、Evidence 类型不匹配、引用没有协议前缀时直接停止而不是掩盖。证据被接受后令牌立即轮换，旧令牌即刻失效 —— 无法重放。契约细节见<a class="ah-prose-a" href="./docs/capability-lifecycle/">Capability 生命周期</a>。</p>`,
  },
  {
    id: 'connecting-your-agent',
    title: '接入你的 Agent',
    html: `<p class="ah-prose-p">把 <code class="ah-code-inline">rex-workflow</code> 编排入口和当前可执行的内置 Provider Skill 投影到客户端标准发现目录：</p>
<div class="group relative w-full my-5"><pre class="bg-card! text-xs! sm:text-sm! border-border overflow-x-auto rounded-md border px-3 py-2.5 font-mono"><code>rex-harness init --client codex
rex-harness init --client claude
rex-harness init --client gemini
rex-harness init --client opencode</code></pre></div>
<p class="ah-prose-p">之后 Agent 一次只加载一个 Provider —— 入口 Skill 读取当前 Command，只执行该 Provider 的目标，然后提交真实证据。完整历史留在 <code class="ah-code-inline">.rex-harness/</code>，不进模型记忆。全部 Provider 见<a class="ah-prose-a" href="./docs/providers/">Provider 目录</a>。</p>`,
  },
  {
    id: 'common-questions',
    title: '常见问题',
    html: `<p class="ah-prose-p"><strong class="ah-prose-strong">需要 AIOS 才能运行吗？</strong>不需要。独立内核拥有 Fact、Capability、Recipe、Activation、Command 和 Evidence 契约。AIOS 在其上增加模型执行、ContextDB、Team、长任务恢复和治理 —— 见<a class="ah-prose-a" href="./docs/architecture/">架构</a>。</p>
<p class="ah-prose-p"><strong class="ah-prose-strong">为什么一次只发一条命令？</strong>因为"全都做"正是 Agent 漂移的方式。单条类型化命令让 Provider 目标有边界、证据可校验、续转点精确。</p>
<p class="ah-prose-p"><strong class="ah-prose-strong">什么算 Evidence？</strong>当前 Evidence Contract 所要求的一切 —— 记录的产物、通过的测试、验证过的行为。引用必须带协议前缀；<code class="ah-code-inline">TODO</code>、<code class="ah-code-inline">TBD</code> 等占位符会被拒绝。规则见<a class="ah-prose-a" href="./docs/provider-contract/">Provider 契约</a>。</p>
<p class="ah-prose-p"><strong class="ah-prose-strong">跑完能审计吗？</strong>能。Evidence Journal 只追加，任何时刻用 <code class="ah-code-inline">--full</code> 都能重建完整 Workflow 对象。</p>`,
  },
  {
    id: 'where-it-fits',
    title: '它在哪里出现',
    html: `<p class="ah-prose-p"><code class="ah-code-inline">rex-harness</code> 是 <a class="ah-prose-a" href="./docs/workflow-ownership/">AIOS 控制面</a>的工作流内核 —— 一个 local-first 层，给 Coding Agent 补上跨会话记忆、协调和可验证证据。你的客户端保持原样，harness 补上它缺失的控制循环。一切都在本机运行，什么都不发出去。</p>`,
  },
];

export const landingSections: Record<Lang, Section[]> = { en, zh };

export const tocItems: Record<Lang, [string, string][]> = {
  en: [
    ['What it does', '#what-it-does'],
    ['When to reach for it', '#when-to-reach-for-it'],
    ['How the loop works', '#how-the-loop-works'],
    ['Running it standalone', '#running-it-standalone'],
    ['Connecting your agent', '#connecting-your-agent'],
    ['Common questions', '#common-questions'],
    ['Where it fits', '#where-it-fits'],
    ['Install the workflow', '#skill-actions'],
  ],
  zh: [
    ['它做什么', '#what-it-does'],
    ['什么时候用它', '#when-to-reach-for-it'],
    ['循环如何运转', '#how-the-loop-works'],
    ['独立运行', '#running-it-standalone'],
    ['接入你的 Agent', '#connecting-your-agent'],
    ['常见问题', '#common-questions'],
    ['它在哪里出现', '#where-it-fits'],
    ['安装工作流', '#skill-actions'],
  ],
};

export const relatedItems: Record<Lang, { kicker: string; title: string; href: string }[]> = {
  en: [
    { kicker: 'Docs', title: 'Getting started: install, init, first run', href: './docs/getting-started/' },
    { kicker: 'Docs', title: 'Architecture: Fact → Capability → Evidence', href: './docs/architecture/' },
    { kicker: 'Docs', title: 'Capability lifecycle and evidence contract', href: './docs/capability-lifecycle/' },
    { kicker: 'Docs', title: 'Provider catalog: 14 built-in skills', href: './docs/providers/' },
  ],
  zh: [
    { kicker: '文档', title: '快速上手：安装、init、第一次运行', href: './docs/getting-started/' },
    { kicker: '文档', title: '架构：Fact → Capability → Evidence', href: './docs/architecture/' },
    { kicker: '文档', title: 'Capability 生命周期与证据契约', href: './docs/capability-lifecycle/' },
    { kicker: '文档', title: 'Provider 目录：14 个内置 Skill', href: './docs/providers/' },
  ],
};
