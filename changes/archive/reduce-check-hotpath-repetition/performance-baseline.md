# Check 热点性能基线

本文件是 `reduce-check-hotpath-repetition` 在实施前的可复核基线。它记录当前重复外部工作的量级，**不**把某次机器的 wall time 作为 Gate profile、语义 Check 边界或并发度调整依据。

## 测量条件

- 基线提交：`2da0bc55859e28c281a29c43e0f72df135471935`（测量前 `HEAD`）。
- 运行时：Bun `1.3.14`、Node.js `v26.7.0`、Git `2.53.0`。
- 工作树/index：index 无暂存改动；工作树只有本 Change 的未跟踪目录 `changes/reduce-check-hotpath-repetition/`。未跟踪内容没有进入 `HEAD` 或 `--baseline-ref HEAD` 的 pending snapshot。
- Gate：`scripts/lib/vibe-gate.ts` 的原生静态 `maxParallel: 4`。测量时没有其他 agent 测试进程；各命令在一个 shell 脚本中逐条串行运行。
- 计时：每个命令成功运行三次，以 `date +%s%N` 包围完整 shell 命令，原始 wall time 为纳秒差。标准输出与错误输出只作为瞬态诊断，未写入本 Change。

Gate 内部会以最多四路并发调度；其 progress/report 的 **per-check duration** 包含同次 Gate 的资源竞争和调度上下文。因此它不能与本表中空闲、串行单独运行同一个 runner 的 wall time 直接比较，也不能把两者相加。

## 实测 wall time

| 目标 | 精确命令 | 第 1 次 (s) | 第 2 次 (s) | 第 3 次 (s) | 中位数 (s) |
| --- | --- | ---: | ---: | ---: | ---: |
| default Gate | `bun run check` | 13.494 | 14.298 | 13.229 | **13.494** |
| full Gate | `bun run check --full --baseline-ref HEAD` | 32.376 | 29.214 | 29.428 | **29.428** |
| Change Plan public distribution | `bun test ./tools/change-plan/tests/checks/public-distribution.ts` | 4.278 | 4.366 | 4.290 | **4.290** |
| Decision Records public distribution | `bun test ./tools/decision-records/tests/checks/public-distribution.ts` | 2.213 | 2.862 | 3.491 | **2.862** |
| Decision Records lifecycle/recovery | `bun test ./tools/decision-records/tests/checks/lifecycle-and-recovery.ts` | 5.914 | 4.253 | 10.880 | **5.914** |
| Decision Records pending stage | `bun test ./tools/decision-records/tests/stage.test.ts` | 6.132 | 4.583 | 4.587 | **4.587** |
| Task Graph public distribution | `bun test ./tools/task-graph/tests/generated-artifacts.test.ts` | 4.073 | 4.041 | 4.240 | **4.073** |
| Test Evidence catalog | `bun test ./tools/test-evidence/tests/catalog.test.ts` | 2.119 | 2.134 | 2.048 | **2.119** |
| Test Evidence ledger CLI | `bun test ./tools/test-evidence/tests/ledger-cli.test.ts` | 2.066 | 1.961 | 1.972 | **1.972** |
| Test Evidence pending stage | `bun test ./tools/test-evidence/tests/staging.test.ts` | 1.513 | 1.512 | 1.417 | **1.512** |
| environment | `bun run test:environment` | 3.180 | 3.237 | 3.182 | **3.182** |
| version control | `bun run test:version-control` | 2.146 | 2.161 | 2.137 | **2.146** |
| skill package hash | `bun run test:skill-package-hash` | 2.106 | 1.953 | 1.904 | **1.953** |

所有 39 次运行均以退出码 0 成功。Decision Records lifecycle/recovery 的第三次为 10.880s 的明显离群值；保留原值，并以三次中位数而非均值作为后续对照。

## 静态外部边界近似

以下是测量前源码的静态文本计数，帮助验收“是否减少重复启动/初始化”。它们**不是实测进程计数**：同一个 helper 可在循环、并发回调或条件分支中执行多次，且导入与函数定义可能出现在搜索结果中。

### Node/Bun CLI 子进程 case

| 文件 | 静态情况 |
| --- | --- |
| `tools/change-plan/tests/cli.test.ts` | 16 个 `node:test` 节点；14 处直接以 `spawnSync("node", [generatedCliPath, ...])` 执行生成 CLI，另有一个同形 helper 定义。 |
| `tools/decision-records/tests/cli-args.test.ts` | 18 个 `node:test` 节点；`runGeneratedCli` 在源码中出现 21 次（包含定义），即约 20 个生成 Node CLI 调用点。 |
| `tools/test-evidence/tests/ledger-cli.test.ts` | 6 个 `node:test` 节点；`runLedgerCli` 出现 13 次（包含导入），其 helper 当前以子进程执行 ledger CLI。 |
| `tools/test-evidence/tests/catalog.test.ts` | 36 个 `node:test` 节点；`runDistributedCliFailure`/`runDistributedCliJson` 共 9 个调用点，均通过分发 CLI 子进程。 |
| `tools/task-graph/tests/cli.test.ts` | 25 个 `node:test` 节点；有 1 个 `spawn(await resolveNodeExecutable(), ...)` helper，用于真实进程边界，实际调用次数需运行时计数才可确定。 |

### Git 初始化 helper 调用点

| 文件 | 静态 `initialize*Repository(...)` 出现数 | 说明 |
| --- | ---: | --- |
| `tools/decision-records/tests/stage.test.ts` | 19 | 包含 imported helper 的调用点；该 runner 是 pending-stage 热点。 |
| `tools/test-evidence/tests/staging.test.ts` | 10 | 含本地 helper 定义，故实际调用点至多比此少 1。 |
| `tools/shared/tests/version-control.test.ts` | 10 | 含本地 helper 定义，故实际调用点至多比此少 1。 |
| `scripts/lib/skill-package-hash.test.ts` | 4 | 含本地 `initializeRepository` 定义；另有两个 fixture builder 会调用它。 |
| `tools/task-graph/tests/staging.test.ts` | 3 | 含本地 helper 定义；实际创建的 repository fixture 还在 wrapper 内调用它。 |

这些近似只为定位可收敛的重复 Git `init/config/add/commit`。后续 fixture 实现必须让每个 case 的 index、worktree、refs、config、lock/recovery 等可变状态继续隔离，不能仅以共享同一 `.git` 目录换取时间。
