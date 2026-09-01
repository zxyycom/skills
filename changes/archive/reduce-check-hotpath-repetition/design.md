# Design

本设计以既有 prerequisite 的显式依赖、源码契约测试和最小真实外部边界减少无效或重复开销，同时保留当前 Gate 和工具的责任归属。

## Context

- `docs/decisions/organize-vibe-checks-by-semantic-identity.md` 规定 Gate leaf 按所证明契约和直接失败 owner 划分，profile、调度和耗时不得承接语义。
- `docs/decisions/generate-and-check-import-safe-tool-artifacts.md` 与 `docs/decisions/assign-tool-and-automation-source-owners.md` 规定 `scripts/build/` 从 `tools/` 真源生成可独立导入的分发制品，`scripts/` 不成为分发运行时依赖。
- Gate 已选择五项 `script:check:<tool>` 生成一致性 Check；Change Plan、Decision Records 与 Task Graph 的分发 consumer 通常读取已提交制品。它们不存在多个重复 build：每项 prerequisite 只构建/核对一次；Task Graph 的四个独立 checkout build 用于证明不同绝对路径生成相同输出，不能共享。
- 当前部分 CLI 参数测试为每个 case 启动 Node，多个 Git 测试 helper 又反复创建相同初始仓库。
- `skills/test-evidence-review/SKILL.md` 与 active Test Evidence 决策要求按可独立选择的最小原生入口维护 case 和闭合关系；测试提速不能减少语义证据或把聚合脚本登记为 case。

## Goals / Non-Goals

目标：

- 让既有生成一致性 Check 先行结算，并使真正消费相应制品的 public-distribution Check 显式依赖它。
- 用直接调用源码入口替代无独特进程语义的 CLI 子进程测试，并保留可审计的最小真实进程证据。
- 将稳定 Git 基线表示为可评审的普通 fixture 文件，并让每次测试从其创建新的真实仓库。
- 以直接命令、测试证据和可重复中位数测量证明正确性和性能，而不是从 Gate 进度显示推断。

本次 CLI 迁移对象为 Change Plan、Decision Records、Test Evidence catalog 与 Test Evidence ledger。Task Graph 已有源码调用和不可替代的 stdin/多进程锁边界；本次只保留并验证其既有分发测试与四次路径确定性构建，不为测试形式一致性新增改造。

非目标：

- 不新建跨工具 build 聚合 Check、共享临时制品目录、Vibe invocation context/env 注入或跨 invocation cache。
- 不声称 dependency 能减少 happy path 的已有 build 次数；它只避免 prerequisite 已失败时的无效 consumer 执行，并改善失败归因。
- 不按耗时拆分、合并或变更现有领域 semantic Check 的证明范围、profile 或失败 owner。
- 不把所有 CLI 测试转为源码调用；不移除 Node 分发、真实 Git、stdout/stderr、退出状态或模块解析的端到端证据。
- 不提交 `.git/`、Git bundle、已生成的可变工作区、绝对路径或运行期临时目录；不为了预期复用而建立没有多个实际消费者的共享 fixture 框架。
- 不改动与三项热点无关的 skill 行为、发布格式、项目文档或现有独立 cache Change。

## Decisions

### Intended Change

1. **既有生成一致性 Check 作为显式 prerequisite。** 扩展 Gate semantic Check 声明的受控 dependency 字段，使 Change Plan、Decision Records 与 Task Graph 的 public-distribution Check 分别 `dependsOn` 当前的 `script:check:change-plan-cli`、`script:check:decision-records-cli`、`script:check:task-graph-cli`。Definition 保留三个 existing package-script Check 为其唯一执行 owner；下游检查在 prerequisite 未取得可信 passed 结果时返回当前 Gate 风格的可行动 blocked/failed 结果而不读取制品。不得合并这些 build、创建新脚本、跨工具 store 或改变 Vibe 0.0.1 的生命周期模型。

   下游只保留工具独有的公开 API、portable metadata、声明/Schema、源码等价、Node smoke 和路径确定性证据。实施审计未发现可由 prerequisite 替代的 public-distribution 断言，因此不以“删除重复断言”描述本次结果；Task Graph 的独立 checkout 构建继续由该工具的 deterministic-path contract 证明，绝不迁移到 prerequisite 或假设可共享。

2. **源码 CLI 测试与真实 Node smoke 分层。** 将每个受影响 CLI 的当前源码入口整理为可在测试中直接调用的最小函数，显式接收 argv、cwd 与 stdout/stderr writer（必要时为 Git/filesystem service 提供已有的局部替身）；入口返回/设置的退出结果保持与命令行 adapter 一致。参数组合、非法输入、领域错误和文本/JSON 输出在 Bun 进程内测此入口。每个迁移的分发 CLI 仅保留少量 Node smoke：可执行分发入口、真实 argv 解析、stdout/stderr 分流、退出状态及目标 Node 环境的模块解析。Smoke 不复制全部参数矩阵。

3. **Git fixture 原始树与一次性仓库启动。** 在每个已确认需要固定 Git 历史的测试 owner 下提交按 scenario 命名的 `fixtures/<scenario>/` 普通源码文件树；相邻启动 helper 复制树到测试私有临时路径，执行 `git init`、固定本地 user 配置、`add` 与基线 `commit`，并返回仓库根与基线 revision。原始树是唯一长期输入，启动 helper 是唯一初始化路径。

   只读 revision/blob 查询可共享同一次启动产出的只读模板；修改 index 的 case 使用独立 `GIT_INDEX_FILE`；修改 worktree 时从模板创建私有副本/worktree；涉及 refs、config、lock 或恢复路径的 case 使用独立一次性仓库。并行测试绝不共享可变 `.git`、index、refs、worktree 或环境变量。各工具先在本地测试目录实现；只有至少两个 owner 消费同一初始化不变量时才把最小 helper 移入 `tools/shared/tests/`。

4. **证据、测量与归档。** 每个迁移后的原生入口、名称和 relation 在同一次改动中通过 Test Evidence owner 更新。实施前后在相同 HEAD/index、运行时、并发配置及空闲条件下至少运行三次受影响 Check 和 default/full Gate，记录中位数、命令、环境与结果；同时用 runner spy/fixture 断言证明 downstream 在 prerequisite 失败时不启动、源码路径零 Node spawn（除 smoke）及 Git 初始化次数受控。完成时进行正确性审阅、AI-ready 文档审阅和编码规范审阅，所有成功标准具备实际证据后才申请归档。

### Resulting Impacts

1. **Gate 依赖与观测。** `SemanticGateCheck`/Definition 需要支持受控的普通 Check dependency，Definition 的选择、release prerequisite 和项目配置 validator 必须保留现有 Check 选择。依赖结果 unavailable/failed 时不启动 consumer；显示名、machine publication ID、default/full 覆盖与静态 `maxParallel: 4` 保持既有含义。
2. **构建命令边界。** 现有单工具 `sync:*`/`check:*` 继续可独立使用，且仍是唯一 build/check owner；不把 tests 反向变成构建编排器。
3. **CLI 可测性。** 源码入口的 I/O/cwd 参数是测试边界，不承诺新增公共 SDK；迁移时核对 source 与 generated adapter 的错误/退出行为一致，避免 test helper 覆盖真实差异。
4. **Fixture 安全和可靠性。** 复制必须保留 fixture 所需的普通文件与相对目录，不跟随或生成仓库外链接；初始化失败、copy 失败和 cleanup 失败必须使所属测试可行动地失败。fixture 不读取调用者工作树、不覆盖真实仓库，并在 Windows/Linux 下采用现有 Git 兼容参数。
5. **长期 owner 同步。** `docs/tooling.md` 仅记录 prerequisite/consumer 依赖、构建/测试边界和重跑方式等稳定行为；测试账本只登记实际最小入口。若实现改变跨 Change 的 Gate 结构理由，按 Decision Records 门槛决定是更新现有 active Vibe decision 还是新增记录，并只用 owner CLI 派生索引。

## Risks / Trade-offs

- prerequisite 只在失败路径节省下游执行，并可能降低成功路径的并行度；这符合依赖所表达的真实制品信任关系，不能把它当作计时优化。
- 直接调用源码入口可能遗漏 Node adapter 差异，因此每个 CLI 仍以固定 smoke 验证真实入口；若某项行为只能由子进程证明，保持该 case 为 E2E。
- 单次 Git 模板会降低初始化成本，但错误的可变状态共享会造成 test pollution；隔离矩阵优先于性能，无法安全复用的 scenario 继续建立私有仓库。
- fixture 原始树会增加受控测试文件；只保存稳定、最小的源内容，避免把生成物或无关历史扩展为长期维护面。
- 性能存在机器噪声；验收使用同一环境的多次中位数并结合次数断言，不以单次 Gate wall time 作为唯一证据。

## Open Questions

无阻塞开放问题。Readiness 已确认迁移 CLI 清单和各 Git scenario 的最小 fixture owner；实施不得扩大上述范围或改变成功标准。
