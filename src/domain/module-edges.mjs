/**
 * 模块边的采集：把「谁 import 了谁」做成纯数据，交给方向判定去读。
 *
 * 中文注释：这是正则近似，不是 AST，局限写明白：它只看相对路径的静态 import / 动态 import 字面量，
 * 不看 re-export、不看别名包、无法区分字符串常量里的假路径。它的作用是把"声明的分层"变成可判定的图，
 * 不是证明依赖不存在。近似声明由 manifest 的 measure 文本与测试共同固定（ADR 0002）。
 */
import path from 'node:path';

const REFERENCE_PATTERNS = Object.freeze([
  /(?:from|import)\s*['"](\.[^'"]+)['"]/gu,
  /import\(\s*['"](\.[^'"]+)['"]\s*\)/gu,
]);

const toPosix = (value) => value.split(path.sep).join('/');

/** 中文注释：把 `../lib/x.mjs` 解析成仓库相对路径；跳出自家目录的引用一律不算（包名引用不算边）。 */
export function resolveRelativeSpec(fromFile, spec) {
  const joined = toPosix(path.normalize(path.join(path.dirname(fromFile), spec)));
  return joined.startsWith('..') ? '' : joined;
}

export function collectModuleEdges({ files = [], readFile, extensions }) {
  // 中文注释：算哪些扩展名由调用方给：domain 不去 import 命令层，
  // 否则我自己的新门第一个就该判它反向依赖。
  const tracked = new Set(files.map((file) => toPosix(file)));
  const edges = new Map();
  for (const file of files) {
    if (!extensions.some((ext) => file.endsWith(ext))) continue;
    let source;
    try {
      source = readFile(toPosix(file));
    } catch {
      continue;
    }
    const targets = [];
    for (const pattern of REFERENCE_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        const resolved = resolveRelativeSpec(toPosix(file), match[1]);
        // 中文注释：只计 tracked 的目标；扩展名补全让 `./x` 能对上 `./x.mjs` 这个真实节点。
        const node = tracked.has(resolved) ? resolved
          : tracked.has(`${resolved}.mjs`) ? `${resolved}.mjs`
            : tracked.has(`${resolved}.js`) ? `${resolved}.js` : '';
        if (node && node !== toPosix(file)) targets.push(node);
      }
    }
    if (targets.length > 0) edges.set(toPosix(file), [...new Set(targets)]);
  }
  return edges;
}
