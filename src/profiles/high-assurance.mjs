import { defaultProfile } from './default.mjs';

// high-assurance 沿用同一套 Capability 词汇，只向 AIOS 请求更强的持久化保证，
// 不会复制或分叉选择算法。
export const highAssuranceProfile = Object.freeze({
  ...defaultProfile,
  id: 'high-assurance',
  description: 'Default capability set with host-enforced strict evidence retention.',
  hostRequirements: Object.freeze(['persistent-plan-for-dependent-work', 'retain-all-verification-evidence']),
});
