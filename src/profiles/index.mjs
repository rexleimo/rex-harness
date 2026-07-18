import { defaultProfile } from './default.mjs';
import { highAssuranceProfile } from './high-assurance.mjs';

const PROFILES = new Map([
  [defaultProfile.id, defaultProfile],
  [highAssuranceProfile.id, highAssuranceProfile],
]);

// 同时接受 Profile ID 和 Profile 对象，方便宿主 Adapter 调用；
// 最终仍解析成本包维护的规范化不可变实例。
export function resolveProfile(profile = 'default') {
  const id = typeof profile === 'string' ? profile : profile?.id;
  const resolved = PROFILES.get(id);
  if (!resolved) throw new Error(`Unknown rex-harness profile: ${id || '(empty)'}`);
  return resolved;
}

// 返回新的数组，避免调用方修改内部 Profile 注册表。
export function listProfiles() {
  return [...PROFILES.values()];
}
