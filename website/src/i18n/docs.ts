import type { Lang } from './ui';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function docsPath(lang: Lang, slug: string): string {
  return `${base}${lang === 'zh' ? '/zh' : ''}/docs/${slug}/`;
}

export function providerPath(lang: Lang, id: string): string {
  return `${docsPath(lang, 'providers')}${id}/`;
}

export function homePath(lang: Lang): string {
  return `${base}${lang === 'zh' ? '/zh' : ''}/`;
}

export interface SidebarSection {
  n: string;
  label: Record<Lang, string>;
  open: boolean;
  items: { label: Record<Lang, string>; href: (lang: Lang) => string }[];
}

export const sidebarSections: SidebarSection[] = [
  {
    n: '1',
    label: { en: 'Getting Started', zh: '快速上手' },
    open: true,
    items: [
      { label: { en: 'Install & setup', zh: '安装与配置' }, href: (l) => docsPath(l, 'getting-started') },
      { label: { en: 'Connect your agent', zh: '接入你的 Agent' }, href: (l) => docsPath(l, 'getting-started') + (l === 'zh' ? '#投影-skill-到你的-agent' : '#project-skills-into-your-agent') },
      { label: { en: 'First run', zh: '第一次运行' }, href: (l) => docsPath(l, 'getting-started') + (l === 'zh' ? '#第一次运行' : '#first-run') },
    ],
  },
  {
    n: '2',
    label: { en: 'Core Concepts', zh: '核心概念' },
    open: true,
    items: [
      { label: { en: 'Architecture', zh: '架构' }, href: (l) => docsPath(l, 'architecture') },
      { label: { en: 'Capability lifecycle', zh: 'Capability 生命周期' }, href: (l) => docsPath(l, 'capability-lifecycle') },
      { label: { en: 'Provider contract', zh: 'Provider 契约' }, href: (l) => docsPath(l, 'provider-contract') },
      { label: { en: 'Workflow ownership', zh: '工作流所有权' }, href: (l) => docsPath(l, 'workflow-ownership') },
    ],
  },
  {
    n: '3',
    label: { en: 'Providers', zh: 'Provider' },
    open: false,
    items: [
      { label: { en: 'Provider catalog', zh: 'Provider 目录' }, href: (l) => docsPath(l, 'providers') },
      { label: { en: 'rex-workflow', zh: 'rex-workflow' }, href: (l) => providerPath(l, 'rex-workflow') },
      { label: { en: 'rex-requirements', zh: 'rex-requirements' }, href: (l) => providerPath(l, 'rex-requirements') },
      { label: { en: 'rex-design', zh: 'rex-design' }, href: (l) => providerPath(l, 'rex-design') },
      { label: { en: 'rex-wayfinder', zh: 'rex-wayfinder' }, href: (l) => providerPath(l, 'rex-wayfinder') },
      { label: { en: 'rex-planning', zh: 'rex-planning' }, href: (l) => providerPath(l, 'rex-planning') },
      { label: { en: 'rex-test-design', zh: 'rex-test-design' }, href: (l) => providerPath(l, 'rex-test-design') },
      { label: { en: 'rex-tdd', zh: 'rex-tdd' }, href: (l) => providerPath(l, 'rex-tdd') },
      { label: { en: 'rex-strict-tdd', zh: 'rex-strict-tdd' }, href: (l) => providerPath(l, 'rex-strict-tdd') },
      { label: { en: 'rex-implement', zh: 'rex-implement' }, href: (l) => providerPath(l, 'rex-implement') },
      { label: { en: 'rex-minimal-construction', zh: 'rex-minimal-construction' }, href: (l) => providerPath(l, 'rex-minimal-construction') },
      { label: { en: 'rex-refactor-hardening', zh: 'rex-refactor-hardening' }, href: (l) => providerPath(l, 'rex-refactor-hardening') },
      { label: { en: 'rex-debug', zh: 'rex-debug' }, href: (l) => providerPath(l, 'rex-debug') },
      { label: { en: 'rex-code-review', zh: 'rex-code-review' }, href: (l) => providerPath(l, 'rex-code-review') },
      { label: { en: 'rex-specialist-review', zh: 'rex-specialist-review' }, href: (l) => providerPath(l, 'rex-specialist-review') },
      { label: { en: 'rex-engineering-standards', zh: 'rex-engineering-standards' }, href: (l) => providerPath(l, 'rex-engineering-standards') },
    ],
  },
  {
    n: '4',
    label: { en: 'Reference', zh: '参考' },
    open: false,
    items: [
      { label: { en: 'CLI commands', zh: 'CLI 命令' }, href: (l) => docsPath(l, 'cli-reference') },
      { label: { en: 'State layout', zh: '状态布局' }, href: (l) => docsPath(l, 'cli-reference') + (l === 'zh' ? '#状态布局' : '#state-layout') },
      { label: { en: 'Core JS API', zh: '核心 JS API' }, href: (l) => docsPath(l, 'cli-reference') + (l === 'zh' ? '#核心-js-api' : '#core-js-api-host-integration') },
    ],
  },
];

export const groupLabels: Record<string, Record<Lang, string>> = {
  'getting-started': { en: 'Getting Started', zh: '快速上手' },
  concepts: { en: 'Core Concepts', zh: '核心概念' },
  reference: { en: 'Reference', zh: '参考' },
};
