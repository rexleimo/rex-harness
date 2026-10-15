export const locales = ['en', 'zh'] as const;
export type Lang = (typeof locales)[number];
export const defaultLocale: Lang = 'en';

export function isLang(v: string | undefined): v is Lang {
  return v === 'en' || v === 'zh';
}

/** Path of the same page in another language. */
export function switchPath(pathname: string, to: Lang): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  if (rest.startsWith('/zh')) rest = rest.slice(3);
  if (rest === '') rest = '/';
  return (to === 'zh' ? `${base}/zh` : base) + rest;
}

const en = {
  'announcement.pill': 'New',
  'announcement.text': 'rex-harness v0.9.1 — the evidence-driven workflow control plane is out.',
  'nav.docs': 'Docs',
  'nav.github': 'GitHub',
  'nav.npm': 'npm',
  'nav.changelog': 'Changelog',
  'nav.install': 'Install rex-harness',
  'lang.label': 'Language',
  'sidebar.docs': 'Docs',
  'sidebar.overview': 'rex-harness overview',
  'hero.kicker': 'The rex-harness Control Plane · 6 min read · Updated Oct 14, 2026',
  'hero.title': 'The rex-harness Workflow',
  'hero.lede': 'One command at a time. Progress only on evidence.',
  'hero.npm': 'npm package',
  'hero.copy': 'Copy command',
  'hero.share': 'Share',
  'hero.next': 'Next page',
  'install.label': 'Install this workflow',
  'install.then': 'Then run',
  'install.inProject': 'in your project.',
  'install.source': 'Source',
  'install.runtime': 'Runtime',
  'install.runtimeValue': 'Node.js 24 · zero services',
  'toc.onThisPage': 'On this page',
  'toc.whereItFits': 'Where this fits',
  'toc.share': 'Share',
  'cta.kicker': 'AIOS · Documentation',
  'cta.title': 'Pressure-tests decisions. Evidence ships them.',
  'cta.body': 'Start with one work item. rex-harness keeps the state, rotates the command token, and only advances when real evidence lands.',
  'cta.docs': 'Read the docs',
  'cta.star': 'Star on GitHub',
  'actions.label': 'Workflow actions',
  'actions.title': 'Install the workflow',
  'actions.tabNpm': 'npm (global)',
  'actions.tabInit': 'Per-agent init',
  'actions.npmHint': 'Installs the standalone kernel. Then run',
  'actions.initHint': 'Projects rex-workflow + provider skills into your agent. Then run',
  'actions.inProject': 'in your project.',
  'actions.doctor': 'Doctor with',
  'actions.source': 'Source code ↗',
  'actions.prev': 'Previous page',
  'actions.here': 'You are here',
  'actions.next': 'Next',
  'related.label': 'Related reading',
  'footer.project': 'Project',
  'footer.docs': 'Docs',
  'footer.host': 'Host',
  'footer.agents': 'Agents',
  'mobile.copy': 'Copy install command',
  'docs.backHome': 'Back to overview',
  'docs.prev': 'Previous',
  'docs.next': 'Next',
};

const zh: Record<keyof typeof en, string> = {
  'announcement.pill': '新',
  'announcement.text': 'rex-harness v0.9.1 发布 —— 证据驱动的工作流控制面。',
  'nav.docs': '文档',
  'nav.github': 'GitHub',
  'nav.npm': 'npm',
  'nav.changelog': '更新日志',
  'nav.install': '安装 rex-harness',
  'lang.label': '语言',
  'sidebar.docs': '文档',
  'sidebar.overview': 'rex-harness 概览',
  'hero.kicker': 'rex-harness 控制面 · 6 分钟阅读 · 更新于 2026-10-14',
  'hero.title': 'rex-harness 工作流',
  'hero.lede': '一次只发一条命令。只有证据才能推进。',
  'hero.npm': 'npm 包',
  'hero.copy': '复制命令',
  'hero.share': '分享',
  'hero.next': '下一页',
  'install.label': '安装这个工作流',
  'install.then': '然后在项目里运行',
  'install.inProject': '。',
  'install.source': '来源',
  'install.runtime': '运行时',
  'install.runtimeValue': 'Node.js 24 · 零服务依赖',
  'toc.onThisPage': '本页目录',
  'toc.whereItFits': '它在哪里出现',
  'toc.share': '分享',
  'cta.kicker': 'AIOS · 文档',
  'cta.title': '压力测试找出弱决策，证据负责让它上线。',
  'cta.body': '从一个 work item 开始。rex-harness 保存状态、轮换命令令牌，只有真实证据落地才会推进。',
  'cta.docs': '阅读文档',
  'cta.star': 'Star on GitHub',
  'actions.label': '工作流操作',
  'actions.title': '安装工作流',
  'actions.tabNpm': 'npm（全局）',
  'actions.tabInit': '按 Agent 初始化',
  'actions.npmHint': '安装独立内核。然后运行',
  'actions.initHint': '把 rex-workflow 与 Provider Skill 投影到你的 Agent。然后运行',
  'actions.inProject': '于你的项目。',
  'actions.doctor': '诊断用',
  'actions.source': '源码仓库 ↗',
  'actions.prev': '上一页',
  'actions.here': '当前所在',
  'actions.next': '下一页',
  'related.label': '相关阅读',
  'footer.project': '项目',
  'footer.docs': '文档',
  'footer.host': '宿主',
  'footer.agents': 'Agent 入口',
  'mobile.copy': '复制安装命令',
  'docs.backHome': '返回概览',
  'docs.prev': '上一篇',
  'docs.next': '下一篇',
};

export const ui: Record<Lang, typeof en> = { en, zh };

export function t(lang: Lang, key: keyof typeof en): string {
  return ui[lang][key];
}
