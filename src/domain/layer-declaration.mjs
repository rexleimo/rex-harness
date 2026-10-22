/**
 * 分层声明与依赖方向的判定。
 *
 * 为什么方向必须来自声明而不是目录名：一个目录名碰巧叫做 foundation，并不表示这个项目
 * 规定了“内层不得依赖外层”。规定是项目的决定，只能由它自己写下来；我从路径名里读出来的
 * 那叫猜测，而猜出来的违规和猜出来的通过一样不可信（ADR 0002）。
 *
 * 因此这个模块的输入契约是闭集：`order`（外层到内层的层名序列）+ `prefixes`（路径前缀 → 层名）。
 * 两者缺一或写坏就报 `invalid-layer`，不抛别的异常、也不静默放宽。
 *
 * 引擎仍然不知道文件系统：调用方喂给它「源文件 → 目标路径列表」（已解析成仓库相对 POSIX 路径）。
 * 怎么得到这张图是宿主已有采集器的能力，这里刻意不再写第二个 import 提取器。
 */

function fail(message) {
  throw Object.assign(new TypeError(`invalid-layer: ${message}`), { code: 'invalid-layer' });
}

function assertLayerNames(order) {
  if (!Array.isArray(order)) fail('layers.order must be an array of layer names, outermost first');
  const seen = new Set();
  for (const name of order) {
    if (typeof name !== 'string' || !name.trim()) fail('layers.order must contain non-empty strings');
    if (seen.has(name)) fail(`layers.order has a duplicate layer: ${name}`);
    seen.add(name);
  }
}

/**
 * @param {{order:string[],prefixes:Record<string,string>}} declaration
 * @returns {{order:string[], ranks:Map<string,number>, prefixes:Array<[string,string]>}}
 */
export function parseLayerDeclaration(declaration) {
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) {
    fail('layers must be an object with order and prefixes');
  }
  const { order, prefixes } = declaration;
  assertLayerNames(order);
  if (!prefixes || typeof prefixes !== 'object' || Array.isArray(prefixes)) {
    fail('layers.prefixes must be an object mapping a path prefix to a layer name');
  }

  const ranks = new Map(order.map((name, index) => [name, index]));
  const entries = [];
  for (const [prefix, layer] of Object.entries(prefixes)) {
    if (typeof layer !== 'string') fail(`layers.prefixes["${prefix}"] must name a layer, got ${typeof layer}`);
    if (!ranks.has(layer)) {
      fail(`layers.prefixes["${prefix}"] names "${layer}" which is not in layers.order: ${order.join(', ')}`);
    }
    entries.push([prefix.replace(/\\/g, '/').replace(/\/+$/u, ''), layer]);
  }

  // 中文注释：长前缀优先——当一个更细的前缀与一个更粗的前缀同属一路时（比如前者归 domain、
  // 后者归 foundation），最短匹配会把细的那个错分进粗的那一层，所以按前缀长度降序尝试。
  entries.sort((a, b) => b[0].length - a[0].length || (a[0] < b[0] ? -1 : 1));
  return Object.freeze({ order: Object.freeze([...order]), ranks, prefixes: Object.freeze(entries) });
}

/** 中文注释：不在任何前缀里的文件就是"未分层"，返回 null 而不是硬塞一层。 */
export function resolveLayer(layers, filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  for (const [prefix, layer] of layers.prefixes) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return layer;
  }
  return null;
}

/**
 * 反向依赖 = 内层指向外层（rank 变小）。同层与向外层指向内层都不算。
 * @param {Map<string,string[]>|Array<[string,string[]]>} edges 源文件 → 目标路径
 * @param {ReturnType<typeof parseLayerDeclaration>} layers
 * @returns {Map<string,number>} 源文件 → 反向依赖条数（只列出命中的文件）
 */
export function measureReverseDependencyEdges(edges, layers) {
  const counts = new Map();
  for (const [source, targets] of edges instanceof Map ? edges : edges) {
    const from = resolveLayer(layers, source);
    if (!from) continue;
    let reverse = 0;
    for (const target of targets || []) {
      const to = resolveLayer(layers, target);
      if (!to) continue;
      if (layers.ranks.get(to) < layers.ranks.get(from)) reverse += 1;
    }
    if (reverse > 0) counts.set(source, reverse);
  }
  return counts;
}
