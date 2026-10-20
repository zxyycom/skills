# Design

以原生能力组织独立质量结果，项目只承担领域验收、可靠输入复用和发布交接。

## Context

方案基于项目提交 `7bd8a96754ef9226ee369a6a1d9dd364183d3370` 的 68 项 catalog 和精确 0.0.4 发布包。
[升级证据](upgrade-evidence.md)保存来源、项目测量与判断边界；
[API 清单](api-migration-matrix.md)承接兼容细节，[Gate 清单](gate-inventory.md)承接身份和依赖映射。
当前生效契约仍由[工具链](../../docs/tooling.md#权威-vibe-门禁)及 proposal 所列决策维护。

## Goals / Non-Goals

目标是减少项目运行职责与状态，保持质量覆盖、持续智能调度、失败定位、可靠复用和发布安全。
范围包括根 Gate、必要指标整改、实测反馈关键路径，以及已获授权的调查报告和决策记录全部最小原生测试分层。
skill 业务、产品 CLI 整体架构、分发架构、系统工具和远端发布协议保持现状。

## Decisions

### Intended Change

#### 最小基线与特殊结构的必要性

以原生构造器、独立 commandCheck、直接依赖、learned helper 和资源约束为基线。
项目扩展以已确认的原生缺口和项目证据为依据，范围限于最小补充责任。

| 责任 | 实现方向 | 项目边界 |
| --- | --- | --- |
| 项目命令执行 | 独立 commandCheck；纯领域计算可直接调用。 | 各命令独立形成原生终态与 transcript，项目保留命令声明和重跑入口。 |
| 智能调度 | 原生 createLearnedCriticalPathStrategy。 | 保留 helper 所需最小 identity/history，适应后续负载变化。 |
| 成功复用 | 项目完整输入身份、通过记录及最终发布。 | 收窄至可安全省略的项目 Check；实现按本节最小职责重组。 |
| 生成前置 | 现有统一生成检查。 | 八项重复 Gate 归并，保留手动领域命令、适配器和产品回归。 |
| 发布私有数据 | typed handoff。 | 共享同一授权快照，machine 只保存摘要。 |

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

#### 同次调用的事实复用

统一生成只采集一次源码引用和根 manifest，以只读 facts 参数传给领域适配器；各 skill 仍独立构造可达模块与产物。
测试快照在一个调用会话内复用模块源码、imports 与存在性，各 command 的闭包和注册集合保持独立，
起止 sourceFingerprint 继续独立读取。七项 AST 规则对普通 `.ts` 且无 `ast-grep-ignore` 文本的输入合并扫描，
其余路径保持原 run 兼容查询；各 command 按自己的闭包筛选匹配。两者均在下次顶层调用重新采集事实，
生成 facts 绑定来源 workspace 并在消费时校验一致。

类型检查使用根配置的原生 incremental 和可丢弃 build info，每次仍以完整 include 和现有质量选项结算；
它复用编译事实，不建立成功 receipt。

项目 receipt 的静态 patterns 依实际 consumer 维护：专用共享能力按真实领域引入，
宽消费者保持全源码或全材料；跨 owner import 与入口变化同步复核传递输入，未闭合时保守执行。

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

#### 调查报告与决策记录测试分层

每个原最小原生入口先恢复证明义务，再选择最小充分层级：独立规则直接调用纯函数或轻量领域函数，
参数/输出与退出映射由同进程 CLI 验证；真实 Git 索引、原子性、路径漂移、外部命令分发和 Node 装载由必要集成节点承担。
边界用例验证实际接线、失败阻断及状态恢复，规则矩阵由直接规则测试承接。

逐项身份、后继入口、去留理由及实际 I/O 分类由 `test-layer-audit/` 两份领域 JSON 承接，
[升级证据](upgrade-evidence.md#测试分层结果)汇总结果与验证边界。合并/删除须有完整后继；
长期 Tests/Contract/Proves 由 Case/index 维护，本目录审计材料随 Change finalize 删除，由 Git 恢复。

规则函数仅从内部源码模块导出并由生产路径调用，公开 barrel 与业务契约保持；分发源码变化同步生成物与独立版本。
领域自验证、Case 完整性和独立正确性审查闭合后，按 proposal 标准取得最终整仓结果及同机成本对照。

#### 验证边界

原生机制按精确发布包的 docs/types 使用。项目验证覆盖实际参数、输入证明、关系、领域结果、
诊断及 CLI/release 消费，优先复用现有项目测试并补齐受改动契约的缺口。
上游负责原生机制通用正确性；只有发现具体 Bug 时才进行针对性复现和修复。

### Resulting Impacts

- 按责任表调整执行、聚合及私有状态代码，按 API 清单迁移保留的调用方和测试替身。
- 更新输入声明、证明 namespace、调度可比身份、catalog fixture 与生成前置。
- 受影响测试同步 Case/index，当前行为落入工具链和 Check 编写 owner，长期理由按决策规则演进。
- 五条指标按[证据](upgrade-evidence.md#指标差异)逐项归因，必要整改进入对应源码 owner。
- 已定位的重复采集在统一生成与测试快照 owner 内复用同次调用事实，保持输入集合、漂移保护与跨调用隔离；按真实消费者维护成功证明输入。
- 两领域测试按逐项审计重新分层；同步必要最小导出、生成物/版本、Case/index 与输入闭包，保留真实边界及失败语义。
- 新测试状态需重新取得最终 base、冷 release、成本对照及独立审查；既有通过结果只证明当时输入，不替代本轮验收。

## Risks / Trade-offs

- 规则下沉与集成保留分别证明规则矩阵和真实边界；逐项审计及独立审查核对覆盖后继，防止丢失接线、失败或恢复语义。
- 成本对照须明确输入、层级、执行/复用量和机器条件；[历史测量](upgrade-evidence.md#final3-分层前输入版本与本地-ci)与本轮完成态分别报告。
- 统一生成扩大共同阻断范围，learned 策略只调整合法任务顺序；输入闭包、资源预算与版本管理隔离保持。

## Open Questions

无未决范围或正确性问题。Case/索引、独立审查与[最终验证](upgrade-evidence.md#最终完整验证)均闭合，三条继任决策已对齐。
远端 CI、Windows 与外部发布未验证；最终交付按实际边界报告，保存完成态和实际 finalize 由主代理执行。
