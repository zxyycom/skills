# Proposal

本 Change 让现有的分发生成一致性 Check 成为其 public-distribution consumer 的显式前置，并以源码 CLI 测试和真实 Git fixture 消除可安全移除的重复外部开销。

## Why

当前热点耗时主要来自大量参数与输出 case 反复启动真实 Node CLI，以及多个测试重复 `git init`、配置和提交相同基线。分发制品已经由现有 `script:check:<tool>` Check 各自构建并核对一次，public-distribution 测试通常读取已提交制品；它们尚未显式依赖对应生成一致性结果，导致上游失败时 consumer 仍会执行并产生无效噪声。

## Outcome

每个受影响的 public-distribution semantic Check 显式依赖其既有的生成一致性 Check；生成失败或漂移时 consumer 不启动，成功路径不新增跨工具共享构建。Change Plan、Decision Records、Test Evidence 的 CLI 将参数、错误、输出与退出码映射移至源码入口测试，只留下最小真实 Node 进程 smoke；Task Graph 保留既有的源码与多进程边界测试。需要固定 Git 历史的测试从已提交的 fixture 原始内容经启动代码复制并真实初始化一次性子仓库，再按测试的可变面隔离消费。

## Scope

### Intended Change

- 为 Change Plan、Decision Records 与 Task Graph 的 public-distribution semantic Check 声明对其既有 `script:check:change-plan-cli`、`script:check:decision-records-cli`、`script:check:task-graph-cli` 的精确依赖；保持每个脚本独立构建/核对一次，不新增跨工具 build 聚合、临时制品存储或 invocation 生命周期协议。
- 将 Change Plan、Decision Records、Test Evidence 的 CLI 测试分为源码入口测试与少量真实进程 smoke；源码入口接受显式 argv、工作目录和可捕获 I/O，保留真实入口、模块解析、`process.argv`、stdout/stderr 与退出状态边界的端到端证据。Task Graph 不为统一形式重写既有测试层次。
- 为需要固定 Git 历史的测试提交专用 fixture 原始源码目录，并提供启动代码：复制该目录到每次测试的一次性临时子仓库、初始化 Git、写入固定身份、创建基线提交；测试只在该仓库及其局部隔离副本、index 或 worktree 中执行。

### Resulting Impacts

- `scripts/lib/vibe-gate.ts`、相关 Gate/项目配置测试和 `docs/tooling.md` 必须把既有生成一致性 Check 的 stable ID、依赖拓扑、失败重跑入口与“不按性能重划语义 Check”的边界保持一致。
- `scripts/build/`、`tools/change-plan/`、`tools/decision-records/` 与 `tools/task-graph/` 的构建适配和分发测试必须明确：生成一致性由现有 prerequisite 证明；consumer 经审计后保留其独有的公开契约，而不宣称删除不存在的重复断言。Task Graph 的四次独立 checkout 构建属于路径确定性契约，继续独立保留。
- 受影响工具的源码 CLI API 可能需要最小、显式的注入参数（argv、cwd、I/O）；公开分发 API、命令行输出、退出码和 Node-only 兼容承诺不能因测试提速而改变。
- Git fixture 的原始内容、启动 helper 和涉及 Git 的测试必须归属对应 `tools/*/tests/` 或已有共享测试 owner；不得提交 `.git/`、绝对路径、运行产物或可变测试状态。只读、index、worktree/ref/config/lock 修改分别采用与风险相称的隔离方式。
- 所有新增、改名、拆分或删除的最小原生测试入口必须同步 `repository-tooling`、相关工具 topic 或 `version-control` topic 的 Test Evidence case/关系，并用统一命令派生索引。
- 完成后运行完整 Gate、记录可重复的性能对比，并在获得完成授权后归档本 Change；缓存 Change `cache-vibe-gate-script-results` 是独立工作，不构成本 Change 的实现前提或修改范围。

## Success Criteria

1. 三个 public-distribution Check 都精确依赖各自既有生成一致性 Check；任一 prerequisite failed 或 unavailable 时 consumer 不启动并指向可重跑的 owner。每个生成一致性脚本仍仅按现有 Gate 选择执行一次，不新增跨工具聚合、缓存或 temporary-artifact protocol。
2. 对每个迁移的 CLI，参数、领域错误、输出与退出码映射由源码入口测试覆盖；真实 Node 进程测试只保留足以证明安装制品入口、真实 `process.argv`、stdout/stderr、退出状态和模块解析的最小 smoke 集合。
3. 每个迁移的 Git fixture 都是受版本控制的原始文件树；启动 helper 在临时路径复制、初始化并提交真实 Git 仓库。不存在提交的 `.git/`、跨 case 可变状态、对用户工作树的写入或依赖本机绝对路径的 fixture。
4. 受影响的最小原生入口、Test Evidence 关系、生成物漂移检查、类型检查、lint 与 `bun run check --full` 均通过；性能验收在相同工作树、index、运行时和无额外负载条件下，以至少三次成功运行的中位数证明 CLI/Git 热点没有回退且重复外部工作减少。

## Affected Owners

- `scripts/lib/vibe-gate.ts`、`scripts/vibe-check.ts`、`scripts/vibe-check.test.ts`、`scripts/validators/` 与 `docs/tooling.md`：Gate catalog、依赖、项目维护入口和稳定说明。
- `scripts/build/`：既有 Change Plan、Decision Records 与 Task Graph 分发构建/漂移验证适配。
- `tools/change-plan/`、`tools/decision-records/`、`tools/task-graph/`：可分发 CLI 源码、生成物与 public-distribution 测试。
- `tools/test-evidence/`：catalog 与 ledger CLI 的源码入口、生成物和分层测试。
- `tools/shared/` 与实际使用 Git fixture 的工具测试目录：共享版本控制语义及其 fixture/bootstrap 边界；只在真实共享后进入共享层。
- `docs/test-evidence/`：受影响最小原生测试入口的权威 case、关系和派生索引。
- `changes/reduce-check-hotpath-repetition/`：本次临时设计、实施顺序、验证证据与最终归档。
