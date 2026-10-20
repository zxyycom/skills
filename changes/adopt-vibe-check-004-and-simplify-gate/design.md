# Design

以原生能力组织独立质量结果，项目只承担领域验收、可靠输入复用和发布交接。

## Context

方案基于项目提交 `7bd8a96754ef9226ee369a6a1d9dd364183d3370` 的 68 项 catalog 和精确 0.0.4 发布包。
[升级证据](upgrade-evidence.md)保存来源、项目测量与判断边界；
[API 清单](api-migration-matrix.md)承接兼容细节，[Gate 清单](gate-inventory.md)承接身份和依赖映射。
当前生效契约仍由[工具链](../../docs/tooling.md#权威-vibe-门禁)及 proposal 所列决策维护。

## Goals / Non-Goals

目标是减少项目运行职责与状态，保持质量覆盖、持续智能调度、失败定位、可靠复用和发布安全。
范围限于根 Gate 及必要的指标整改；skill 业务、分发架构、系统工具和远端发布协议保持现状。

## Decisions

### Intended Change

#### 最小基线与特殊结构的必要性

以原生构造器、独立 commandCheck、直接依赖、learned helper 和资源约束为基线。
项目自建扩展须说明原生缺口、当前证据、最小补充及维护成本；已有结构本身不构成保留依据。

| 责任 | 目标实现 | 替代或保留范围 |
| --- | --- | --- |
| 项目命令执行 | 独立 commandCheck；纯领域计算可直接调用。 | 原生命令生命周期替代自有通用 runner、批次 worker/JUnit/leader、结果投影及批次成功证明。 |
| 智能调度 | 原生 createLearnedCriticalPathStrategy。 | 保留 helper 所需最小 identity/history，适应后续负载变化。 |
| 成功复用 | 项目完整输入身份、通过记录及最终发布。 | 收窄至可安全省略的项目 Check；实现按本节最小职责重组。 |
| 生成前置 | 现有统一生成检查。 | 八项重复 Gate 归并，保留手动领域命令、适配器和产品回归。 |
| 发布私有数据 | typed handoff。 | 替代外置 ReleaseState，共享同一授权快照。 |

必要性依据见[特殊结构结论](upgrade-evidence.md#特殊结构的必要性结论)。

#### 执行与结果

原生构造器直接承接身份、依赖、资源和 flags；领域函数保持模块状态、取消与隔离边界。
外部命令显式继承当前环境，以退出状态结算，提供完整 transcript、受控 artifact、直接重跑命令和安全诊断。
存在真实结构协议时才使用 afterCommand。初始限额如下，按实际项目负载验收：

| 命令 | 超时 | stdout/stderr 各自上限 |
| --- | --- | --- |
| 环境 | 30s | 1MiB |
| 测试、静态检查和生成 | 120s | 16MiB |

#### 输入、选择与成功证明

“成功证明”指项目 Check 在某个完整输入身份下已通过的记录（receipt）。
Git revision 路径变化和计算事实缓存不建立这个项目事实，因此项目负责：

1. 声明可省略 Check 实际读取的源码、测试/fixtures、生成材料、配置和工具链。
   身份包含稳定 Check ID、契约版本、内容及必要环境；未知依赖扩大执行。
2. 一次起始采集覆盖 Git 可见项和声明的磁盘输入，含 TS/MTS、runtime/manifest/lock、fixtures、索引、
   missing 与 symlink。越界、读取失败、预算不足或输入域未闭合时执行对应工作。
3. 原生材料 Checks 每次实际执行，按自身能力复用事实缓存并按当前规则结算。
   Markdown 直接目标和锚点由本次链接验证承担；Schema 使用现有两项 schemas、两项 bindings 和 offline catalog。
4. 精确命中成功证明时才省略项目 Check。依赖激活交给 Vibe，机器输出保持真实未激活状态。
5. 最终 Run 成功后重取同一输入域，一致才原子发布。取消、失败、output failure、rejection 或漂移时
   不发布；证明不可用时执行。release、CI 与 cold 均真实执行。

文件选择使用完整 patterns，默认排除与业务范围分开；输入身份覆盖声明的实际读取域。
依赖字节沿用受信 frozen-lock 安装前提；工具链探测不可用时扩大执行。
项目只维护输入声明、内容身份和成功事务，路径关系及执行授权采用原生能力。

#### 智能调度与资源

使用原生 learned helper 持续调整 ready task 顺序；Scheduler 仍掌握依赖、mutex 和资源准入。
项目提供 absolute stateDirectory 与 canonical-JSON-compatible identity：覆盖稳定 Task ID、base/release profile、
实现契约及影响时长可比性的配置和环境，不含敏感值。任务结构或命令方式变化时更新对应身份。

history 沿用 `.log/vibe-check/cache/scheduler-history/` 的可丢弃本地状态与清理责任。
缺失/损坏/不兼容历史、预测或记录失败按原生退化契约处理，性能状态与成功证明分离。
真实 callback consumer 适配新版 descriptor/terminalEffect；测量仅采集实际消费字段。

保持 root 4、external-process 3、repository-scan 2、release cpu-work 4，
以及 version-control 独占全部 CPU units 的边界。

#### 发布交接

prepare 捕获一次 Git pending snapshot；authorization 通过直接依赖取得并授权它，pack 消费同一引用。
provider 身份、跨 Run 隔离及私有 Map/bytes 的释放责任明确，machine data 只保存摘要。
所有结果保持环境成功前置；release 和 CI/cold 使用完整项目执行路径。

#### Check 组成与内容规则

按[清单](gate-inventory.md#目标身份映射)落实八项生成 Gate 归并和四项新增，预期 64 项。
统一生成前置失败时，分发消费者共同阻断；artifact 路径及领域手动命令承担定位。
MCPShell 三项新增复用既有离线测试；真实 SSH 集成和 Index Runtime 规模回归保持专用入口。

Markdown 内容 Check 使用 blocking policy，选择 `**/*.[mM][dD]` 与
`**/*.[mM][aA][rR][kK][dD][oO][wW][nN]`，沿用原生默认排除，另排除：
`docs/investigations/_resources/**`、`docs/investigations/_candidate.*`、
`skills/**/references/upstream/**`、`skills/**/reference-original.md`。
启用 no-reversed-links、no-missing-space-atx、no-empty-links、no-alt-text、reference-links-images、
table-column-count 六规则；目标及锚点完整性仍由链接 Check 承接。

#### 验证边界

原生机制按精确发布包的 docs/types 使用。项目验证覆盖实际参数、输入证明、关系、领域结果、
诊断及 CLI/release 消费，优先复用现有项目测试并补齐受改动契约的缺口。
上游负责原生机制通用正确性；只有发现具体 Bug 时才进行针对性复现和修复。

### Resulting Impacts

- 按责任表调整执行、聚合及私有状态代码，按 API 清单迁移保留的调用方和测试替身。
- 更新输入声明、证明 namespace、调度可比身份、catalog fixture 与生成前置。
- 受影响测试同步 Case/index，当前行为落入工具链和 Check 编写 owner，长期理由按决策规则演进。
- 五条指标按[证据](upgrade-evidence.md#指标差异)逐项归因，必要整改进入对应源码 owner。

## Risks / Trade-offs

- 已有成本对照只覆盖 31 项工作负载；完整新 DAG、三进程预算和各运行平台仍须实际验收。
- 原生材料扫描约 5.63–6.68s，已接近日常反馈预算；完整 CLI 还包含输入采集、初始化与项目命令。
  无变化、单 owner、共享 owner 场景分别定位关键路径，直到满足 proposal 标准。
- 统一生成前置扩大共同阻断范围，智能调度也不保证每轮更快；两者均需报告真实项目成本。
- 安全复用依赖输入闭合，边界尚未闭合的 Check 保守执行；逐项输入回归是实施验收前置。

## Open Questions

无阻塞开始实施的结构选择。五条指标归因由 1.7/2.5 处理，完整 DAG 性能由 1.5/2.7 处理；
它们必须满足成功标准后才能结项。若处理需要改变质量政策、资源隔离或发布协议，先确认相应范围。
