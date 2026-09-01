# Tasks

本计划先建立真实热点和 owner 基线，再以显式 prerequisite、源码 CLI 与隔离 Git fixture 依次替换重复工作，最后同时验收正确性、证据和性能。

## Readiness

- [x] 0.1 核对 `scripts/lib/vibe-gate.ts` 的 catalog、Definition、release dependency、项目配置 validator、既有五项 `script:check:<tool>` 与三个 public-distribution Check，确认逐工具 prerequisite 映射、stable ID、profile 和失败 owner；确认不新建跨工具 build 聚合。
- [x] 0.2 审计 Change Plan、Decision Records、Task Graph 的 build/check 适配和 generated-artifacts/public-distribution 测试，逐项区分“当前工作树制品漂移”“独立 checkout 的路径确定性”“公开 API/声明/Schema”“真实 Node 入口”证据；确认没有多个 consumer 重复 build，并标记 Task Graph 四次 checkout build 为保留契约。
- [x] 0.3 审计受影响 CLI 的源码入口、generated adapter 和现有 Node spawn case；为每个工具列出可直接调用的参数/错误/输出/退出码 case、必须保留的真实进程 smoke 以及所需最小注入边界。
- [x] 0.4 审计 Change Plan、Decision Records、Task Graph、Test Evidence、Version Control 和其他实际热点 Git 测试的初始化调用图；为每个稳定 scenario 确定原始文件树、初始 commit、可变面和 owner，拒绝没有重复基线或隔离方案的迁移。
- [x] 0.5 在相同 HEAD/index、锁定 runtime、静态 Gate 并发和无额外负载下，各成功运行至少三次受影响 Check、default 与 full Gate；记录命令、环境、每项中位数、Node spawn/Git init/build 次数和失败输出，作为实施基线。
- [x] 0.6 核对受影响最小原生入口及其 Test Evidence case/relations，预先确定需要更新的 topic、case 文件和统一索引命令；确认 cache Change 不在本 Change 的读取、实现或验收依赖中。

## Implementation

- [x] 1.1 扩展 Gate semantic Check 声明与 Definition，使三个 public-distribution consumer 显式依赖对应既有 `script:check:*` prerequisite；同步 Gate/项目配置测试和 machine publication 断言，保持既有脚本、profile、release prerequisite、Check ID 与静态并发语义不变。
- [x] 1.2 审计三个 public-distribution consumer：确认没有可由 prerequisite 替代的重复断言，保留各工具独有的公开 API、portable metadata、声明/Schema、独立路径确定性和分发模块契约；不改动 Task Graph 的独立 checkout build。
- [x] 1.3 为 Change Plan、Decision Records、Test Evidence catalog 与 Test Evidence ledger 提取最小源码调用入口和局部 I/O/cwd 注入；把参数、错误、文本/JSON 输出和退出映射迁移为 Bun 内源码测试，不改变分发模块的公开 API 或命令行行为。Task Graph 保留已有源码调用与 stdin/多进程锁边界，不为统一形式改造。
- [x] 1.4 为每个迁移 CLI 保留并收敛真实 Node smoke，覆盖分发文件启动、真实 argv、模块解析、stdout/stderr 分流和退出状态；删除只重复源码断言的进程 case，不删除独有端到端边界。
- [x] 1.5 在每个确认的 Git 测试 owner 下提交最小、按 scenario 命名的 `fixtures/<scenario>/` 原始文件树，并实现相邻启动 helper：复制到私有临时目录、真实 `git init`、固定配置、`add`、基线提交和 cleanup。禁止提交 `.git`、绝对路径和运行产物。
- [x] 1.6 将需要稳定 Git 基线的 case 迁移到 fixture bootstrap；按只读、index、worktree 与 refs/config/lock/recovery 的隔离矩阵消费模板，证明并行 case 不共享任何可变 Git 状态。仅在至少两个实际 consumer 出现后提取最小 shared helper。
- [x] 1.7 更新受影响 Test Evidence 的最小入口、case 内容和关系，并通过 `bun run test-evidence -- sync-index --write --root .` 派生索引；按 Decision Records 门槛同步确实变化的长期 Gate 结构理由和其索引。
- [x] 1.8 更新 `docs/tooling.md` 中的稳定重跑入口、prerequisite/consumer 依赖与测试层次边界；不记录单次耗时、临时 fixture 路径、历史方案或 cache Change 细节。

## Verification

- [x] 2.1 为 Gate dependency 增加测试：三个 prerequisite 各自仍只按 Gate 选择执行一次，consumer 仅在对应 prerequisite passed 时开始；failed/unavailable 时给出可行动 owner，profile、release prerequisite、machine publication 和重复 ID 校验仍正确。
- [x] 2.2 分别运行三个原有 `check:*` 与每个 public-distribution Check，验证 source-to-artifact 漂移、可移植元数据、声明/Schema、路径独立性和 public API 仍具有完整且不重复的证明。
- [x] 2.3 为每个迁移 CLI 验证源码入口的参数矩阵、成功/失败、stdout/stderr 和退出码，并运行保留的 Node smoke，证明 source 与 generated entry 的真实边界一致且非 smoke case 不再 spawn Node。
- [x] 2.4 为每个 Git fixture 验证普通原始树复制、真实基线 revision、初始化错误处理、cleanup、无 `.git` 提交与无绝对路径；并以并行或交叉 mutation 验证 index、worktree、refs/config/lock/recovery 的隔离不污染其他 case。
- [x] 2.5 运行受影响工具的原生测试、`bun run typecheck`、`bun run lint`、`bun run check:test-evidence-catalog`、相关 build drift Check 与 `bun run check --full`，记录实际命令和结果。
- [x] 2.6 按 0.5 的相同条件重复至少三次热点 Check、default 和 full Gate，比较中位数与 Node/Git 初始化计数；确认 CLI/Git 热点没有回退且重复外部工作减少，并明确 prerequisite 的收益只在 failure path。
- [x] 2.7 派发仅审阅正确性的 reviewer，核对 prerequisite 依赖、CLI 证据分层、Git 可变状态隔离和 Test Evidence 闭合；修复其有效发现后复跑受影响验证。
- [x] 2.8 派发优化 reviewer：以 AI-ready docs 审阅 Change 与稳定说明的目标、owner、边界和重跑指引，以编码规范审阅实现的最小性、类型、局部抽象、错误处理与测试可读性；修复有效发现并重跑受影响验证。
- [x] 2.9 对照 proposal Success Criteria、稳定 owner、Test Evidence 和性能记录完成最终语义验收；获得归档授权后运行 Change Plan archive，并按项目 Git 提交组织流程为该完成 Change 创建一次独立归档提交。
