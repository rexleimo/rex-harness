/**
 * 重复片段的**近似**度量：连续 N 行归一化文本在两个文件里都出现，就算这段是副本。
 *
 * 为什么是近似而不是 AST：第一期不追求工具级精度（ADR 0002 的假设清单里写着这条）。近似版的
 * 局限必须说清楚，否则"0 重复"会被读成结构性证明：
 * - 逐行文本比较，所以改一个变量名、换一种引号就看不见；
 * - 连续窗口相同才算，窗口之下的相似片段不算（宁可漏报也不冤枉人）；
 * - 空行与行首尾空白不参与指纹，缩进差异不会掩盖重复。
 *
 * 引擎仍然不知道文件、git、路径这件事：调用方给它「已读到的文件内容」，它回一个「路径 → 参与
 * 重复的行数」。测哪个根、哪些扩展名算源码，还是调用方的决定。
 */
export const DUPLICATE_WINDOW_LINES = 6;

function fingerprint(lines, from, window) {
  let text = '';
  for (let i = from; i < from + window; i += 1) text += `${lines[i]}\n`;
  return text;
}

function normalizedLines(content) {
  return content.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
}

/**
 * @param {Array<{path:string, content:string}>} fileReads 调用方已读到的内容
 * @param {{windowLines?: number}} options 窗口长度，默认 6 行
 * @returns {Map<string,number>} 路径 → 参与重复的行数（只包含确有副本的文件）
 */
export function measureDuplicateLines(fileReads = [], { windowLines = DUPLICATE_WINDOW_LINES } = {}) {
  if (!Number.isInteger(windowLines) || windowLines <= 0) {
    throw new TypeError(`measureDuplicateLines needs a positive integer windowLines; got ${windowLines}`);
  }

  // 中文注释：重复的语义是“同一份内容在两个地方”：所以同一个文件内的副本也要计入 owners。
  // Set 里装的是 (path + 窗口起点)，不是 path——否则一个文件里的两处副本会被当成一处。
  const seen = new Map();
  const perFile = fileReads
    .filter(({ path, content }) => typeof path === 'string' && typeof content === 'string')
    .sort((a, b) => (a.path < b.path ? -1 : 1));

  for (const { path, content } of perFile) {
    const lines = normalizedLines(content);
    for (let start = 0; start + windowLines <= lines.length; start += 1) {
      const key = fingerprint(lines, start, windowLines);
      const owners = seen.get(key) || new Set();
      owners.add(`${path}#${start}`);
      seen.set(key, owners);
    }
  }

  const result = new Map();
  for (const { path, content } of perFile) {
    const lines = normalizedLines(content);
    if (lines.length < windowLines) continue;
    const duplicated = new Set();
    for (let start = 0; start + windowLines <= lines.length; start += 1) {
      const owners = seen.get(fingerprint(lines, start, windowLines));
      // 出现位置是窗口起点，覆盖的原始行数按窗口计：相邻窗口会重叠，所以用 Set 去重行号。
      if (owners && owners.size > 1) {
        for (let i = start; i < start + windowLines; i += 1) duplicated.add(i);
      }
    }
    if (duplicated.size > 0) result.set(path, duplicated.size);
  }
  return result;
}
