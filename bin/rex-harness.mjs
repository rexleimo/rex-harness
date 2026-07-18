#!/usr/bin/env node

import { runDoctorArgs } from '../src/cli/doctor.mjs';
import { runEvidence } from '../src/cli/evidence.mjs';
import { explainFacts } from '../src/cli/explain.mjs';
import { runInit } from '../src/cli/init.mjs';
import { runStart } from '../src/cli/start.mjs';
import { runResume, runStatus } from '../src/cli/status.mjs';

// 可执行文件只负责解析和输出命令；选择策略保留在 composition root，
// 确保 CLI 与未来的 AIOS Adapter 共用完全相同的逻辑。
const [command = 'help', ...args] = process.argv.slice(2);

try {
  let result;
  if (command === 'doctor') {
    result = runDoctorArgs(args);
    process.exitCode = result.status === 'ready' ? 0 : 1;
  } else if (command === 'init') {
    result = runInit(args);
    process.exitCode = result.status === 'conflicts' ? 2 : 0;
  } else if (command === 'explain') {
    result = explainFacts(args);
  } else if (command === 'start') {
    result = runStart(args);
  } else if (command === 'status') {
    result = runStatus(args);
  } else if (command === 'resume') {
    result = runResume(args);
  } else if (command === 'evidence') {
    result = runEvidence(args);
  } else {
    result = {
      usage: 'rex-harness <doctor|init|explain|start|status|evidence|resume>',
    };
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    schemaVersion: 1,
    kind: 'rex.cli-error.v1',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
}
