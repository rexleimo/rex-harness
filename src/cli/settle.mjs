import { readFileSync } from 'node:fs';
import { settleStandaloneTurn } from '../standalone/store.mjs';
import {
  parseOptions,
  rootOption,
} from './options.mjs';

function readStdinTurnResult() {
  const raw = readFileSync(0, 'utf8');
  if (!raw.trim()) throw new Error('settle requires a turn result JSON on stdin');
  return JSON.parse(raw);
}

/**
 * 结算门 CLI：stdin 读 turn 结果，进程内执行 settleStandaloneTurn。
 * 与 verify 的分工：verify 是只读独立校验（executor 侧放行门），settle 是
 * 控制面的唯一写路径。调用顺序必须是先 verify 后 settle。
 */
export function runSettle(args, { cwd = process.cwd() } = {}) {
  const options = parseOptions(args);
  const rootDir = rootOption(options, cwd);
  const result = settleStandaloneTurn({ rootDir, turnResult: readStdinTurnResult() });
  return Object.freeze({
    schemaVersion: 1,
    kind: 'rex.cli.turn-settle.v1',
    ...result,
  });
}
