# Check 热点性能复测

本文件在实现完成、归档前记录 `reduce-check-hotpath-repetition` 的复测结果。它与 [实施前基线](./performance-baseline.md) 使用相同的目标、命令和计时方法；仅以中位数比较同一运行环境内的相对变化，不能据此改变 Gate 的语义边界、profile 或并发配置。

## 测量条件

- `HEAD`：`2da0bc55859e28c281a29c43e0f72df135471935`；实现仍在未暂存工作树中，因此提交与基线相同，但测试实际读取当前工作树。
- 运行时：Bun `1.3.14`、Node.js `v26.7.0`、Git `2.53.0`。
- index 无暂存改动。工作树只含本 Change 实现及其关联的长期文档、生成制品和证据改动；没有混入其他任务改动。
- Gate 仍使用 `scripts/lib/vibe-gate.ts` 的静态 `maxParallel: 4`。测量期间没有并发的测试负载；命令逐条串行执行。
- 表中的每个命令成功执行三次，以 `date +%s%N` 包围完整 shell 命令。原始 stdout/stderr 仅作为瞬态诊断，不进入 Change 或 Git。

Gate 内最多四路并行执行。因此其单个 Check 的报告耗时会受资源竞争影响；本表只比较完整 Gate wall time 与同条件基线，不能把 Gate 内部耗时和单独 runner wall time 相加。

## 实测 wall time

| 目标 | 精确命令 | 第 1 次 (s) | 第 2 次 (s) | 第 3 次 (s) | 本次中位数 (s) | 基线中位数 (s) | 变化 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| default Gate | `bun run check` | 14.918 | 13.879 | 14.523 | **14.523** | 13.494 | +7.6% |
| full Gate | `bun run check --full --baseline-ref HEAD` | 29.757 | 30.272 | 29.185 | **29.757** | 29.428 | +1.1% |
| Change Plan public distribution | `bun test ./tools/change-plan/tests/checks/public-distribution.ts` | 1.433 | 1.490 | 1.414 | **1.433** | 4.290 | -66.6% |
| Decision Records public distribution | `bun test ./tools/decision-records/tests/checks/public-distribution.ts` | 0.493 | 0.505 | 0.505 | **0.505** | 2.862 | -82.4% |
| Decision Records lifecycle/recovery | `bun test ./tools/decision-records/tests/checks/lifecycle-and-recovery.ts` | 3.881 | 4.043 | 3.905 | **3.905** | 5.914 | -34.0% |
| Decision Records pending stage | `bun test ./tools/decision-records/tests/stage.test.ts` | 4.370 | 4.356 | 4.362 | **4.362** | 4.587 | -4.9% |
| Task Graph public distribution | `bun test ./tools/task-graph/tests/generated-artifacts.test.ts` | 3.945 | 4.163 | 3.985 | **3.985** | 4.073 | -2.2% |
| Test Evidence catalog | `bun test ./tools/test-evidence/tests/catalog.test.ts` | 1.015 | 1.093 | 1.064 | **1.064** | 2.119 | -49.8% |
| Test Evidence ledger CLI | `bun test ./tools/test-evidence/tests/ledger-cli.test.ts` | 0.393 | 0.376 | 0.392 | **0.392** | 1.972 | -80.1% |
| Test Evidence pending stage | `bun test ./tools/test-evidence/tests/staging.test.ts` | 1.385 | 1.539 | 1.450 | **1.450** | 1.512 | -4.1% |
| environment | `bun run test:environment` | 3.155 | 3.059 | 3.074 | **3.074** | 3.182 | -3.4% |
| version control | `bun run test:version-control` | 1.930 | 2.112 | 2.155 | **2.112** | 2.146 | -1.6% |
| skill package hash | `bun run test:skill-package-hash` | 2.212 | 2.317 | 2.170 | **2.212** | 1.953 | +13.3%（见后续独立 AB） |

上述三次运行均以退出码 0 成功，但三次 `skill-package-hash` 的顺序性样本与 Git/文件系统冷热状态耦合，不能单独判定回归。default/full Gate 分别为 +7.6%/+1.1%，不支持“用 prerequisite 加速成功路径”的结论：依赖改变失败路径行为，并会改变 Gate 中的并发资源竞争；它没有新增或删除成功路径的跨工具 build。

## Skill package hash 独立 AB

为核对前三次样本中 `skill-package-hash` 的表面 +13.3%，在相同运行时和空闲条件下，另行对实施前基线与当前工作树各运行 14 次，并以正序和反序交替，避免单一冷热顺序决定结果。两个样本集均全部成功。

| 样本 | 运行次数 | 中位数 (s) | 相对基线 |
| --- | ---: | ---: | ---: |
| 实施前基线 | 14 | **2.071** | — |
| 当前工作树 | 14 | **1.858** | **-10.3%** |

正序比较为 -6.3%，反序比较为 -8.9%。两种顺序均与整体 AB 的下降方向一致，因此原三次表中的 +13.3% 是次序与冷热噪声，不是可复现的 `skill-package-hash` 回归。

同一 AB 还记录了 Git 外部边界调用总数：

| Git 操作 | 基线 | 当前 | 变化 |
| --- | ---: | ---: | ---: |
| 全部 Git 调用 | 569 | 519 | -50 |
| `init` | 12 | 3 | -9 |
| `config` | 36 | 9 | -27 |
| `add` | 44 | 35 | -9 |
| `commit` | 19 | 11 | -8 |

这些计数证明复用仅移除了重复初始化；每个 consumer 仍复制模板获得私有 `.git`、index、worktree、refs 与 config。

## 重复外部边界证据

以下计数是源代码可审查的结构性证据，不是对每次子进程的运行时插桩。它补充 wall time：即使机器噪声改变单次计时，也能确认被删除的重复外部边界没有重新出现。

### Node CLI 启动

| runner | 基线中的静态生成 CLI 调用点 | 当前最小真实 Node smoke 调用点 | 变化 | 当前保留的原因 |
| --- | ---: | ---: | ---: | --- |
| Change Plan `cli.test.ts` | 14 | 2 | -85.7% | 成功与失败协议各一次；其他参数、输出和退出映射直接调用 `runChangePlanCli`。 |
| Decision Records `cli-args.test.ts` | 20 | 2 | -90.0% | 生成入口的成功与失败协议；其余 Commander 参数矩阵直接调用 `runDecisionRecordsCli`。 |
| Test Evidence `ledger-cli.test.ts` | 6 | 2 | -66.7% | 成功与非法参数 smoke；其余 ledger CLI 契约直接调用源码入口。 |
| Test Evidence `catalog.test.ts` | 9 | 2 | -77.8% | 一个真实成功和一个真实失败，仍覆盖分发模块解析、argv、stdout 与失败输出。 |
| 合计 | 49 | 8 | **-83.7%** | Task Graph 的 stdin/多进程锁边界不属于本表，按独有 E2E 语义保留。 |

当前调用点可直接在四个 runner 的 `runNodeCli`、`runLedgerCliSmoke` 和 `execFileAsync("node", …)` 中核对；其余已迁移 case 通过显式 argv、cwd、stdout/stderr 注入调用源码入口。

### Git 初始化

`tools/shared/tests/git-fixture.ts` 是唯一的普通 fixture 物化入口：每次模板创建都会复制受版本控制的原始树，然后执行一次 `git init --initial-branch=main`、本地配置、add 和 baseline commit。消费者只复制该模板；副本仍有独立 `.git`、index、worktree、refs 和 config，不共享可变状态。

| 受影响 runner / fixture | 实现前重复初始化形态 | 当前受控形态 |
| --- | --- | --- |
| environment | 已有运行时模板：测试在首次需要时物化一次，再向 consumer 复制私有仓库。 | 将模板的原始内容落到受版本控制的 fixture；仍由同一运行时模板物化一次并供 9 个消费者复制。 |
| Decision Records stage | 基线静态文本有 19 个 `initializeGitRepository` 引用（含 import，至多 18 个直接调用）。 | 固定历史消费者走 `gitFixtureTemplate ??=` 的 1 个模板；仍需特殊可变状态的 4 个 case 继续直接初始化。 |
| Test Evidence staging | 基线静态文本有 10 个初始化引用（含 helper 定义，至多 9 个调用）。 | `fixtureTemplates ??=` 每 runner 仅物化 4 个具名 scenario 模板，再为每个 case 复制私有仓库。 |
| skill package hash | 多个 pending/version-gate case 各自构造相同基线。 | 两个缓存模板（pending、version-gate）各初始化一次；消费者复制模板，仅保留 1 个确有独特历史的直接初始化。 |
| version control | 常规 snapshot case 重复构造同一 base/current/staged 基线。 | 常规 `createRepositoryFixture` 消费 1 个缓存模板；隔离、冲突与恢复专有情形仍各自初始化，不为性能共享可变 Git 状态。 |

这证明 Git 优化没有用共享 `.git` 牺牲隔离：fixture 原始树不含 `.git` 或链接，模板和每个 consumer 的 `.git` realpath 由测试显式比较。

## 结论与边界

- CLI 参数矩阵的真实 Node 启动显著收敛，四个受影响 runner 的中位数均下降 49.8% 以上；Decision Records lifecycle/recovery 也下降 34.0%。
- Git fixture 复用降低重复的 `init/config/add/commit`，但保留需要独立 refs、config、lock/recovery 或可变历史的真实仓库。environment 的本次变化是把既有运行时模板的原始内容改为受控 fixture，而不是减少该 runner 的初始化次数。独立 AB 显示 `skill-package-hash` 未回归且降低 10.3%；其他 Git 热点不承诺同等 wall-time 降幅。
- 三项 Gate prerequisite 的可计时收益只存在于 prerequisite failed/unavailable 时：consumer 不启动且结果指向直接 owner。成功路径仍各执行既有单工具 `check:*` 一次，default/full 的本次差异受改动范围和四路并发资源噪声影响，不能据此声称性能收益或回归。
