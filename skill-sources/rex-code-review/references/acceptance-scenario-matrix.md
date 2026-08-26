# Acceptance scenario matrix

场景化子代理验收（rex-code-review 的 Acceptance 模式）的可复用模板。用途：把"行为验证"从静态双轴审查中分离出来，在隔离子代理里按场景矩阵实际执行目标并回收证据。

## 何时使用

- 用户要求"子代理验收 / 场景验收 / 对目标跑正常/边界/异常场景 / 无上下文污染验收"。
- 改动声称修复了某种运行时行为（卡死、超时、挂起、资源泄漏、并发竞态），静态读 diff 无法证明修复有效。

## 三场景矩阵（A / B / C）

每个验收目标必须至少覆盖以下三类，逐项断言 PASS/FAIL + 证据：

### A 正常场景（happy path）
- 目标声明的核心行为在理想输入下成立。
- 例子：单命令执行返回 stdout+exit code；tools/list / initialize 正常；并发请求 id 对应正确。

### B 边界场景（boundary）
- 参数钳制、幂等、非法输入、并发时序、接近阈值的行为。
- 例子：timeout 参数钳制到 [1000, 300000]；重复迁移 status=unchanged；空 command 返回 -32602；用户已有配置不被覆盖；并发两条长命令不串包。

### C 异常场景（abnormal / failure）
- 取消时序、上游崩溃、资源清理、僵尸进程、通知在完成之后到达。
- 例子：notifications/cancelled 在途命令立即终止并返回 cancelled 标记；stdin 关闭清理在途命令；子进程树真的被杀（Windows taskkill /T /F；POSIX 进程组）；取消通知在命令已完成之后到达不崩溃；上游进程退出后 proxy 不挂死。

## 子代理 prompt 模板

```text
仓库：<abs-repo>。冻结基准：HEAD=<sha>，工作树 <N> 个文件未提交改动。
你必须先用 bash 执行 cd <abs-repo> && git rev-parse --show-toplevel && git status --short --branch
核对仓库身份，若 toplevel 不是 <abs-repo> 立即返回 REPO_MISMATCH 并停止。
禁止编辑任何文件（只读验收）。
验收对象文件（已冻结）：
- <path>（哈希 <hash>）
- ...
对照基准看 diff：git --no-pager diff HEAD -- <files>

验收目标：<目标声明的行为，逐条列出>

必须执行的验收（用 node --test scripts/tests/<target>.test.mjs 及手写最小复现探针，临时目录，不污染仓库）：
A 正常场景：<清单>
B 边界场景：<清单>
C 异常场景：<清单>

输出格式（≤400 字，中文）：每类场景列 PASS/FAIL + 证据（命令/输出摘录）；
任何 FAIL 给出文件+行号+可执行修复建议；结尾一行：发现数 + 最严重问题。
禁止报告你没实际运行过的验证。
```

## 哈希冻结命令（Windows 仓库必须用 --no-filters）

```bash
git rev-parse HEAD
git status --short --branch
for f in $(git diff --name-only HEAD); do
  printf "%s  %s\n" "$(git hash-object --no-filters -- "$f")" "$f"
done
```

子代理 prompt 里的哈希校验命令必须与父侧冻结时**逐字节一致**；子代理若用默认 `git hash-object`（text=auto CRLF 过滤器生效）会得到不同哈希，把"命令不一致"误报成 REPO_MISMATCH。父侧先复核（`git hash-object --no-filters` 未变即命令差异误报），不直接丢弃或重派。

## 结果回收

- 子代理自报不是证据：父代理读回每个 FAIL 引用的源码行/命令，无法复现或超出冻结范围即丢弃。
- REPO_MISMATCH / 未返回结果 → 该片标 `acceptance-incomplete`，不并入汇总。
- 汇总按片呈现：`## Acceptance: <面>`，PASS/FAIL 计数 + 最严重问题；结尾一行总发现数。
- 验收通过 ≠ 产品完成：只写"所验收场景全部通过（A/B/C 各 N 项）"，未覆盖场景、未回收片、静态审查遗留 finding 必须并列说明。

## 2026-08-26 实测样例（harness-cli aios-shell 卡死修复验收）

- 分片：shell-mcp-server 并发/取消/进程树（片 1）；stdio-proxy 并发转发（片 2）；MCP 配置生成（片 3）。
- 片 1 关键断言：长命令（sleep 2）在途时 ping <1500ms 响应且先于命令返回；notifications/cancelled 立即终止并返回 cancelled；stdin 关闭清理在途命令；taskkill /T /F 杀进程树。
- 片 2 关键断言：慢上游（1500ms fake upstream）在途时 ping <1200ms 响应且先于 call 返回；并发两条 call id 不串包；上游崩溃不挂死。
- 片 3 关键断言：buildShellMcpServer 保留 aios-mcp-proxy.mjs 链路 + AIOS_MCP_PROXY env；startupTimeoutSec 透传（60/30/30）；migrateOneMcpOpencodeJson 注入 experimental.mcp_timeout=90000 且不覆盖用户已有值；幂等 unchanged。
- 教训：子代理报告哈希失配时先复核父侧 `--no-filters` 命令，本样例 3 片均因子代理误用默认 hash-object / `git rev-parse HEAD:` 报失配，父侧复核后判定为命令差异误报，结果有效。
