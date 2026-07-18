import { CAPABILITY } from '../domain/capability-ids.mjs';

// Profile 只声明启用哪些语义能力，不负责把任务划分成 Fast、Balanced 或 Deep。
// 最终激活什么仍由运行时 Fact 决定。
export const defaultProfile = Object.freeze({
  id: 'default',
  description: 'Minimal-first software delivery with evidence-triggered escalation.',
  enabledCapabilities: Object.freeze(Object.values(CAPABILITY)),
});
