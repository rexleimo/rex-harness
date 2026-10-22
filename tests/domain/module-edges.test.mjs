import assert from 'node:assert/strict';
import test from 'node:test';

import { collectModuleEdges, resolveRelativeSpec } from '../../src/domain/module-edges.mjs';

const EXTENSIONS = Object.freeze(['.mjs', '.js']);
const FILES = ['a/m.mjs', 'a/b.mjs', 'root.mjs', 'notes.md'];

test('a relative import becomes an edge to the tracked node it resolves to', () => {
  const source = [
    "import { b } from './b.mjs';",
    "import { x } from '../root.mjs';",
    "const lazy = () => import('./deep/inner.mjs');",
    "import { pkg } from 'some-package/thing.mjs';",
    "export const text = './gone.mjs 写在字符串里也会被我当成边：这是正则近似已声明的代价;'.slice(0, 1);",
  ].join('\n');

  const edges = collectModuleEdges({
    files: FILES,
    extensions: EXTENSIONS,
    readFile: (file) => (file === 'a/m.mjs' ? source : ''),
  });

  assert.deepEqual(edges.get('a/m.mjs'), ['a/b.mjs', 'root.mjs'],
    '自家相对路径算边；包名不算；未 tracked 的目标不算（所以假如 gone.mjs 不会进图，但写进字符串的假路径确实会被当成边——那是本度量已声明的近似代价）');
  assert.ok(!edges.has('notes.md'), '非源码扩展名不产边');
  assert.ok(!edges.has('root.mjs'), '没 import 任何文件的节点不该出现在图里');
});

test('a spec that walks out of the repository is not an edge', () => {
  assert.equal(resolveRelativeSpec('a/m.mjs', '../../outside/x.mjs'), '',
    '跳出仓库根的路径不属于这张图');
  assert.equal(resolveRelativeSpec('a/m.mjs', './b.mjs'), 'a/b.mjs');
});
