# Design

在现有索引运行时与版本管理分层内，集中两域 stage 的共同策略和阶段顺序，保留领域合法性与文件发现适配。本文承接实施设计与验收边界，进度以 tasks 为准。

## Context

### 事实基线与用语

实施基线为 `4043171705d7fd667b135e9898c6f66f3221161d`；下表保存实施前事实，当前结果见 Implementation Observations 与 tasks，长期契约由各 owner 承接。H 表示固定 HEAD revision 的发布事实，W 表示本阶段工作区发布投影及相关来源，P 表示本阶段捕获的 pending；“完整 pending”均指本领域全部受管路径集合，不仅是本次选中或更新路径；受管集合外由共享替换事务保护。下文 `index`／`domain`／`all` 表示本次操作的更新 scope。

| 基线事实 | 事实 owner／实现入口 |
| --- | --- |
| 两域均以 P 的索引为底，选中 ID 取 W state 与逐 ID revision，未选沿用 P，最终完整校验 | [独立暂存判断](../../docs/decisions/refresh-selected-records-in-pending.md)、`tools/index-runtime/src/staging-selection.ts` |
| parse／build／serialize、投影组合以及 pending snapshot／patch 已共享；领域阶段顺序仍分散 | [Index Runtime](../../tools/index-runtime/README.md)、[版本管理中间层](../../tools/shared/version-control.md)、两工具维护入口 |
| Decision 执行两次完整 prepare；每次读取 H/W/P，并在依赖保护时再次捕获 P，index 仍采用默认完整 payload | `tools/decision-records/src/decision-stage-refresh.ts`、`decision-stage-refresh-context.ts`、[Decision 操作契约](../../skills/decision-records/references/cli-operations.md#待提交快照) |
| Investigation index 复用初始 P，写前独立重取，并显式使用 `payloadScope: "content-paths"`；all/domain 仍完整验证 | `tools/investigation-report/src/staging-domain.ts`、`staging-pending.ts`、[Investigation 操作契约](../../skills/investigation-report/references/cli-operations.md#待提交快照) |
| 通用 Index Runtime selected stage 使用 revision baseline，不能因两域 P-base 收敛而改变其他消费者 | [Index Runtime 暂存契约](../../tools/index-runtime/README.md#按-id-staging-到-pending)、[独立暂存判断](../../docs/decisions/refresh-selected-records-in-pending.md) |

共享 API 已区分身份保护、payload 验收和内容保留；减少保留不等于减少读取或验证。固定 H 的数据可以调用内复用；W/P 不预设跨阶段不变，必须由本阶段独立读取的真实内容与完整身份证明等价后，才可复用不可变解析与确定性构建事实。完整索引、关系图、pending 成员及物理事务复制仍有集合级成本。

## Goals / Non-Goals

目标是让两个现有消费者共同依赖一个 stage 策略与阶段 owner；减少无职责的重复读取／构建，同时让失败和漂移边界可追踪。用实测区分 payload I/O、解析／图、成员保护及物理复制成本，不把局部读取量当作整体复杂度。

非目标：不统一两域模型、关系类型、格式或公开 DTO；不重做架构，不新增持久缓存、跨调用上下文或变更清单，不建立通用 record engine／provider registry，不优化 new、candidates、search 等其他操作，不做 10W 或全组合性能扫描。

## Decisions

### Intended Change

以下为本 Change 已选择的实施方案；实际完成与生效范围以任务证据和同步后的长期 owner 为准。用户已明确同意将 Investigation 的 index payload 验收边界同步到 Decision。

#### 共同决策矩阵

| 共同选择 | 两域共同保证 | 边界／例外 |
| --- | --- | --- |
| P-base 完整刷新 | 已选择对象在指定 scope 内取当前完整版本，未选保持 P；state 与逐 ID revision 同步组合 | 不做字段／正文片段合并，不因已有静态部分暂存报并发冲突 |
| scope 分离 | index 只发布投影；domain 只领域文件并保留 P 索引原字节／缺失；all 原子组合 | domain 即使 P 索引损坏也不代为修复，不声称索引与正文已配套 |
| 发布基线与显式闭合 | H/W 及需要的 P 索引严格合法且 metadata、sourceRevision.metadata、definition 兼容；合成投影完整验收 | H/P 都无索引可从空基底组合；H 有索引但 P 删除时 index/all 拒绝；依赖缺失提示补选，不自动夹带 |
| 按已知身份与位置选择 | 从 H/W、需要的 P 投影及已变化 pending 正文身份解析选择与旧位置 | 不重建全部 H 正文，不发现全部未知位置的未同步身份；ID/name 解析仍领域适配 |
| index 按消费验收 | P 全体成员保留 path、mode、OID 身份保护，只读取并指纹验收目标索引 payload，更新也限于该路径 | 不证明非索引 payload 即时可读、指纹有效或语义正确；这是 Decision 的明确保证变化，非默认全局放宽 |
| all/domain 完整验收 | P 全部 unique 对象完整 payload 验证，只保留所需字节；领域来源／树按自身契约验收 | 减少重复不能跳过完整 payload、资源安全或必要依赖 |
| 阶段新鲜度 | 固定 H 投影及纯 H 事实可调用内复用；准备与写前各自 fresh 获取并验收 W/P、相关成员／字节／表示。新鲜输入证明等价后，可复用本调用已验证的不可变解析与确定性构建结果 | 不能省略真实内容读取或以 OID 单独替代内容等价；目录、fileMode 和领域来源仍各阶段取得，不能把两阶段折成一次或跨调用缓存 |
| 发布与反馈 | 锁内检查 fresh HEAD 指针和 P CAS，写后按原策略验证目标、保留范围外，结果只报告实际事实 | unchanged 也通过必要保护；失败保持原有冲突、可恢复失败、partial-or-unknown 责任 |

#### 共同机制及 owner

采用“共享核心＋领域窄适配”，并保留三个现有责任层：

| 层 | 纳入的责任 | 不纳入的责任 |
| --- | --- | --- |
| `tools/index-runtime/` 内部记录 stage 接点 | 两域共同 scope 策略、阶段顺序、三方索引兼容检查、P-base 投影组合／完整构建、fresh 事实比较和一次受保护发布 | 不改变通用 `stageSelectedIndexEntries` 的 H-base 默认；不解析领域 Markdown、关系类型或资源路径 |
| `tools/shared/src/version-control/` | opaque pending snapshot、策略内 payload、完整成员身份、有效文件表示、CAS／写后保护／恢复 | 不认识记录 ID、selector、sourcePath 领域规则或资源 owner |
| 两域现有 stage 模块 | 领域 definition、selector 解析、正式文件／旧位置／依赖发现、来源与领域验证、诊断／输出映射 | 不各自重新维护共同 scope 策略或准备→复核→发布顺序 |

内部模块 `tools/index-runtime/src/record-staging.ts` 承接两个现有记录消费者的阶段协调，不从公共 runtime/SDK 导出。它直接组合既有 parse/build/serialize、`selectTargetSnapshot`、`readPendingSnapshot`／`samePendingSnapshots`／`replacePendingSnapshot`，底层规则仍由原 owner 维护。

最小接点只需要：领域 definition 与位置；selector→完整 ID 的解析；在给定阶段事实下取得领域写集和可比较保护证据的窄适配；领域失败／成功映射。index 分支不调用正文／资源适配。scope 用封闭分支表达，不引入大量可选 callback、feature flags 或 provider 选择协议。共享协调器决定何时调用、比较和发布，不能把同一流程重新留给两个调用者。

共同流程顺序：

1. 固定 H revision，取得可复用的合法 H 投影及必要不可变成员；准备阶段 fresh 读取 W 发布索引与 P，按 scope 取得 pending 所需内容。
2. 由领域解析选择、位置与必要依赖；index/all 以 P 为底组合选中投影并完整构建验证，domain 不解析／重写 P 索引。
3. 准备领域写集与保护证据。index 直接复用已捕获 P，不为相同职责再捕获；all/domain 的依赖扩展若需要追加保留字节，必须保持同阶段 snapshot 等价并说明必要性，不能以“一次读取”优化名义遗漏验证。
4. 写前独立 fresh 重取 W/P 及对应领域事实，完成所需 payload 验收和完整身份比较；在固定 H／definition、选择和实际输入内容均等价的条件成立后，可复用本调用已验证的不可变解析／确定性目标，不重复相同输入的完整图构建。差异或非法输入继续按原阶段错误优先级处理；目录、来源字节与表示依据仍 fresh 获取并比较，不把内容等价延伸为这些可变边界的免检。fileMode 每阶段至多读取一次，关闭时使用本阶段完整 pending 表示依据。
5. 将完整期望 P 与固定 H revision、精确 updates 交给共享替换；底层锁内 HEAD/P CAS、写后验证与范围外保护照常执行。结果由领域入口按现有形状输出，不把普通错误附会成 mutation。

具体类型以能表达上述证据与顺序的最小封闭模型实现；若窄接点不足以保持某领域保证，先修正该适配，而不是将领域判断下沉 Git 层或放宽保护。

#### 必须保留的领域差异

| 责任 | Decision Records | Investigation Report | 留置位置 |
| --- | --- | --- | --- |
| 身份／路径／状态 | Decision ID/name 选择；status 与 alignment；active 根目录／archived 的 archive 位置及 sourcePath 一致性 | Investigation ID/name 选择；formedAt 与正式根目录来源，不引入 Decision 生命周期 | 各自 selector、path、definition 与 parser |
| 合法图 | 决策演进类型、生命周期／alignment 约束、拆分／归并／重划等最终图闭合 | 调查认识关系、formedAt 时序、完整拆分／纯归并等闭合 | 各自完整集合 validator，不统一关系类型 |
| 正式来源 | 决策正式正文完整性、ID、投影与 fingerprint；相关决策 pending 来源配套 | 报告正文、resourceIds、直接引用与必要正式 owner 依赖 | 各自来源／依赖适配 |
| 文件集合 | 所选正文、已知旧位置及 pending-only 身份；保留 root/archive 移动语义 | 所选正文加 H/P/W 所选 owner 树并集，包含未引用成员、合法删除和空树；共享 owner 只验证，不自动暂存 | 各自成员发现／写集适配 |
| 路径与表示 | 保持正式决策路径安全与当前允许的文件表示 | 读资源字节前检查根、owner、全部分量；引用路径字符契约与未引用普通安全路径分开；目录身份／casefold／fileMode 保证 | 各自路径安全＋共享有效表示原语，不把资源规则泛化给 Decision |

#### 现有接口兼容（非领域差异）

Decision 保留既有 command、路径显示与诊断 envelope；Investigation 保留 namespace、state、changed、diagnostics envelope。这些是当前接口兼容责任，不是必然领域差异；共同核心提供可核对事实，由各自入口映射。

当前字段语义也不同：Decision 的 `preservedPendingPaths` 来自全部未更新 snapshot 成员，`pendingFileCount` 计完整 scope 成员；Investigation 的保留路径来自相对固定 H 已变化的 pending 路径，包含 staged 删除。共同核心提供成员、实际变更路径及相对 H 的变化 metadata 等事实，两域继续各自现有字段含义；本 Change 不统一 DTO 或借展示补读正文。后续若要统一字段语义，须另行明确接口变更，不能作为本次隐藏影响。

#### 候选结构与最小共享接点

- **全部泛化为通用记录引擎**：需要把关系、状态、资源和文件发现变成配置协议；变化隔离差，非目标，否决。
- **继续两处局部实现，仅复制同样优化**：保留领域差异最简单，但同一 payload 策略、fresh 顺序和保护边界仍重复维护，不能兑现 Outcome，否决。
- **仅共享投影函数／Git 原语**：这些已存在，不能消除阶段策略分叉；作为底层继续复用，不作为本次终点。
- **共享 stage 协调＋领域适配（选择）**：以两个现有消费者的共同阶段义务建立窄接点，领域新增 owner 安全规则只改相应适配；共同 payload 或阶段比较策略只改协调 owner。实施审查用这两个反事实检查实际边界。

### Resulting Impacts

1. Decision index 的验收责任调整为与 Investigation 相同的消费边界。[两域 payload 判断](../../docs/decisions/scope-record-index-payload-validation.md)按 [Decision 规则](../../skills/decision-records/SKILL.md)修订并完整承接 [Investigation 前序](../../docs/decisions/archive/scope-investigation-index-payload-validation.md)，已核对并 aligned；scope/default、其他消费者与 revision prefix 的保证保持。
2. 两域操作文档说明同一共同保证，但各自保留领域要求和结果形状；共享 README 只维护实现责任，避免复制领域规则。当前普通查询、候选、发布等操作不接入新协调器。
3. 共享模块依赖按实际生成闭包交付，审计 `scripts/build/`、打包输入、hash、public distribution、版本授权和门禁 tool subscriptions；只有真实受影响项才更新。取得原始字节的 storage-source 提取同时进入 Decision、Investigation、Novel Cards 与 Test Evidence 四个现有消费者，四包同步并独立升版；后二者的普通 load 行为保持不变。生成副本通过同步命令产生，不直接修改。
4. 新增／调整测试按 [Test Evidence Review](../../skills/test-evidence-review/SKILL.md)维护最小原生入口对应 Case 与索引；共同机制建立两域配对证据，领域安全测试不能被“共享测试通过”替代。
5. 主要工作委派给 `gpt-6.1-sol` 子代理；阶段审查仅核对真实契约与正确性，不承担最终优化职责。交付前另派独立优化子代理，以 [编码规范](../../docs/coding-style.md)为权威优化整体变更代码及直接影响边界，周边历史代码仅作参考，不引入无必要抽象；另做最终 AI-ready 文档优化，确认消费路径可恢复、事实／目标与 owner 不混淆。优化修改后执行必要重验，再取得最终门禁证据。

## Risks / Trade-offs

- **变相降低保护**：把 OID 当实际 payload 指纹、只比较写入路径、跳过 unchanged 保护均不接受。仅 index 明确改变非索引 payload 的即时验收责任；其成员／mode／OID、staged 删除和范围外保护继续完整。
- **过度共享**：若接口需要领域分支或巨量可选 hook，说明边界未收敛；保持领域适配，缩小共享输入，不引入新引擎。仅移动文件而仍由两域编排也不算完成。
- **错误漂移**：结构检查、source drift、pending conflict、实际系统故障和恢复不完整必须保留可区分事实；共享错误需由现有入口准确映射，不能统一吞成无变化。
- **收益不确定**：Decision 重复工作存在不代表已知加速比；Investigation 当前 index 已优化，提取共享后可能只有维护收益。全集索引／图、pending 成员与物理复制成本不会自动消失。

### 1W 验收策略

固定两个领域各 10,000 条正式存量，记录数据形状、关系密度、正文／资源字节、Git 配置、运行时版本、revision 与测量方法；候选实现和 baseline 用相同输入与配置，干净 fixture 可重复恢复。测量只使用隔离 fixture，不修改工作仓库的真实记录。

采用有限代表场景而非笛卡尔组合：两域 index 是主原生性能对照，同条件 baseline 与候选各 3 次；all/domain 仅保留必要代表样本并说明覆盖理由。选中数量保持常数，不随存量扩大；资源差异用 Investigation 的一个必要 owner 场景代表。连续 A→B 与修改后重选 A 优先由小 fixture 验证；若增加 1W 连续序列，只作独立效果组，不混入主性能样本。初始化、sync 和 fixture 恢复成本与 stage 测量分开；先固定预热与噪声判据，再采集前后数据，报告全部样本而非单次最好值。不展开 scope×异常×连续状态×次数的全组合。

记录 wall、进程树 CPU 与 wait4 最大进程峰值 RSS（非同时子树总量）；工作量用少量代表调用单独采样，至少区分 pending 捕获／payload 字节、固定 H 读取、W 来源字节、parse／build／图、成员枚举及物理 index 复制。采样不计入正式计时，不增加产品遥测。独立后验使用非被测 stage 逻辑核对最终 pending 索引 selected/unselected state 与 revision、领域文件字节／表示／删除、scope 外保持及工作区未改动。

正确性、故障注入和竞态使用小 fixture：共同配对覆盖无 H、索引缺失／损坏／metadata 不兼容、静态部分暂存、增删移动／ID 更正、依赖补选、两阶段漂移、锁内冲突、恢复失败、unchanged；index 覆盖非索引 payload 不可读但身份稳定、所需索引 payload 失败及完整身份漂移，all/domain 仍拒绝坏 payload。领域特有路径／资源／图／生命周期另验，不在 1W 重跑故障全集。

Investigation 若超出同机噪声的稳定回退，先定位并消除不必要重复；无法消除则带证据重新审阅设计，不静默降低验收。Decision 必须前后实测和解释剩余成本，不填写未经证明的提升目标。

## Open Questions

无。内部接点、生成闭包与 payload 决策继承方式已核定，结果见上文及 tasks；剩余交付验收不属于开放设计问题。

## Implementation Observations

首轮 1W 候选未通过性能验收：IR index wall 中位数 `2.459 → 3.190s`，回退 `29.70%`，组内极差不足 `2.1%`；DR 为 `6.787 → 3.628s`。独立探针确认 IR 的 H/W/payload 范围、捕获、枚举及物理复制未增加，而 parse `4 → 5`、target build `1 → 2`、graph build `4 → 7`。首轮候选聚合 SHA 为 `9354aa4a93b66390a6a3dc0c358c7dbf0b3b821afbf85657e44609b979a2a367`；原始证据由调查 `261022-record-stage-convergence-10k` 留存。

据此收敛 fresh 的实现责任：独立读取、实际 payload 验收、完整身份与领域来源／表示复核保持；对于已由 fresh 输入等价证明确定不变的纯解析和目标构建，复用同次不可变结果。此修正保持既定 index 验收范围，已通过定向正确性复核与 v2 完整配对性能验收；v2 是后续结构整理前的中间组，不代表最终运行时。

原始索引字节继续由现有 storage owner 读取、校验与诊断，普通 load wrapper 保持原语义，不在 record-staging 复制边界规则。该内部提取真实进入四个分发闭包，依照必要影响同步四包；不让其他领域操作接入记录协调器。

最终规范整理按真实 owner 收敛具名阶段准备／冻结／等价比较、Decision 成功映射与 Investigation 单调用适配，解除函数、重复及文件指标阻断，未改变质量政策。结构整理后的完整 `check:changed` 61 项实际通过（`20261022T181954944Z-866ce725-3317-4a8f-820a-93a0ee6058a3`），独立正确性定向复核无阻断。

因运行时结构变化，另冻结 v3（工具树 SHA `da02d787b3926d96f8a0331b4332b51ea927e72b80f469e1f66e410ba60142a1`）重测同一有限矩阵。最终同轮 index 各版各 3 次，DR wall 中位数 `6.712542 → 2.342072s`（−65.11%），IR 为 `2.529476 → 2.148688s`（−15.05%），CPU／RSS 均下降，工作量与 v2 相同。all/domain 各版仅 1 次正式代表样本，不作统计结论。80 次观测、14 次 probe 及三轮共 18 步连续重选后验均通过；v1／v2 证据原字节保留，最终性能结论仅取 v3。完整样本、源码指纹、独立后验与计量边界由[本轮调查](../../docs/investigations/record-stage-convergence-10k.md)承接；覆盖本轮文档收敛的最终 Gate、完成态保存与 finalize 仍以 tasks 和实际命令结果为准。
