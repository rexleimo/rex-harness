import path from 'node:path';

export function parseOptions(args = [], { booleanFlags = [] } = {}) {
  const options = new Map();
  const booleans = new Set(booleanFlags);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!flag.startsWith('--')) throw new Error(`unexpected argument: ${flag}`);
    const key = flag.slice(2);
    if (booleans.has(key)) {
      options.set(key, [...(options.get(key) || []), true]);
      continue;
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`missing value for ${flag}`);
    options.set(key, [...(options.get(key) || []), value]);
    index += 1;
  }
  return options;
}

export function option(options, key, { required = false, fallback = '' } = {}) {
  const value = String(options.get(key)?.at(-1) || fallback).trim();
  if (required && !value) throw new Error(`missing required option: --${key}`);
  return value;
}

export function rootOption(options, cwd = process.cwd()) {
  return path.resolve(option(options, 'root', { fallback: cwd }));
}

export function booleanOption(options, key) {
  return options.get(key)?.at(-1) === true;
}

export function evidenceOptions(options) {
  const values = options.get('evidence') || [];
  const evidence = values.map((value) => {
    const separator = value.indexOf('=');
    if (separator <= 0 || separator === value.length - 1) {
      throw new Error('--evidence must use kind=ref format');
    }
    return {
      kind: value.slice(0, separator).trim(),
      refs: [value.slice(separator + 1).trim()],
    };
  });

  const kind = option(options, 'kind');
  const refs = options.get('ref') || [];
  if (kind || refs.length > 0) {
    if (!kind || refs.length === 0) throw new Error('--kind requires at least one --ref');
    evidence.push({ kind, refs });
  }
  if (evidence.length === 0) throw new Error('evidence command requires --evidence or --kind/--ref');
  return evidence;
}
