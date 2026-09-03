# Design

本设计把 `YYMMDD-<name>.md` 固定为 Decision 和 Investigation 新实例的可读完整 ID，并让每个领域在自己的集合和事务边界内解析唯一名称；本文仍处于 Draft，开放问题收敛后再派生任务并进入 Plan。

## Context

- [`保留型工件重名调查`](../../docs/investigations/260903-explore-name-collisions-in-retained-artifacts.md)是本 Change 的问题与方案证据；它不是已经生效的长期契约。
- Decision Records 当前以全集合唯一的 Markdown basename 作为稳定 ID，active 与 archived 共用 ID-keyed 索引，查询、关系、生命周期和 stage 都要求完整 ID。候选在 `new` 时已有 ID，但正式 `createdAt` 只在建立时写入。
- Investigation Report 当前以正式集合唯一的 Markdown basename 作为 ID，每份报告已有精确 `formedAt`；索引按 ID 键控，关系和资源 owner 都依赖该 ID stem。
- 当前长期决策要求 Decision ID 稳定并用于关系、查询和生命周期。日期成为 ID 的组成不会削弱稳定性，但允许名称简写会演进当前“完整 ID 作为操作输入”和 ID-keyed 查询契约，实施前必须建立后继 Decision。
- 两个可分发 CLI 的维护源码分别位于 `tools/decision-records/` 和 `tools/investigation-report/`，由 `scripts/build/` 下对应入口生成 skill 内脚本、声明与索引 Schema。
- Change Plan 不属于本 Change。[`complete-change-plans-by-deletion`](../complete-change-plans-by-deletion/)单独负责取消 archive 并让完成历史通过 Git 恢复；因此 Change 不需要日期身份或名称 resolver。

## Goals / Non-Goals

目标：

- 让完整 ID 兼具日期顺序、语义可读性和当前规模所需的防碰撞能力。
- 让使用者在名称唯一时不必记忆日期，并在名称重名时被强制转为精确选择。
- 让关系与其他持久引用始终保存完整 ID，不因后来的名称重复而漂移。
- 保持 Decision 与 Investigation 各自的权威源、索引、关系、资源、生命周期和 mutation 边界。
- 兼容现有无日期 ID，并为新格式提供可验证的创建和查询行为。

非目标：

- 不改造 Change Plan 的目录名、查询、生命周期或完成行为。
- 不保证无限规模或数学意义上的全局唯一，不引入 UUID、随机短码、时分秒或自动序号。
- 不建立跨项目或跨领域共享的 ID namespace、名称服务或分配器。
- 不在本 Change 中批量重命名 legacy 记录；单对象 rename 由独立 Change 承接。
- 不改变 Decision 或 Investigation 的关系类型、图形状和生命周期语义。
- 不让集合过滤、全文搜索或 `list` 因单对象解析规则而只能返回一项。

## Decisions

### Intended Change

#### 完整 ID

新实例使用以下规范外形：

```text
Decision:      260903-adopt-date-prefixed-record-identities.md
Investigation: 260903-explore-name-collisions-in-retained-artifacts.md
```

`YYMMDD` 是记录形成日期的 UTC 投影，固定放在语义名称前。解析器移除首个日期前缀和连字符后取得语义名称；legacy ID 没有日期前缀时，其现有 stem 整体作为语义名称。日期只是 ID 的可读组成，不替代精确时间字段，也不从 ID 反向改写生命周期事实。

各领域日期来源为：

| 领域 | 新实例日期来源 | 精确时间 owner |
| --- | --- | --- |
| Investigation | `formedAt` 转为 UTC 后的日期 | 报告 frontmatter `formedAt` |
| Decision | `new` 成功创建 candidate 时的 UTC 日期 | 建立后的 `createdAt`；ID 日期不声称是激活时间 |

Investigation checker 验证日期前缀与 `formedAt` 的 UTC 日期一致。Decision candidate 在建立后保留原 ID，`createdAt` 继续表示正式建立时间；重新激活 archived Decision 不改变 ID 日期。

#### 名称解析

需要选择一个或多个具体记录的公开入口复用同一领域 resolver，但调用语法可以按既有 CLI 形状适配：

1. 显式完整 ID 只做 exact match，不从日期、状态或顺序猜测替代目标。
2. 显式名称在该操作适用的完整集合中按解析后的语义名称 exact match。
3. 零项命中返回 not-found；一项命中解析为其完整 ID；两项及以上命中返回 ambiguous，按完整 ID 排序列出全部候选并零写入失败。
4. 不使用“最新一项”、active 优先、目录顺序或首项命中消除歧义。
5. 关系 source/target、批量选择和 mutation 输入先逐项解析，再以完整 ID 完成最终图或事务预演；权威 Markdown 与索引只保存完整 ID。

集合型 `list`、filter 和全文查询继续允许返回多个结果。名称简写是精确对象选择的便利入口，不是模糊搜索或新的持久身份。

#### 创建与冲突

Decision 和 Investigation 的现有 `new` 接口增加语义名称输入并由工具分配日期前缀 ID。两个入口都必须在各自集合 mutation lock 内重读最终目标并执行原子 no-overwrite。

同日期、同语义名称会产生同一个完整 ID。若目标已存在，创建失败并要求调用方判断是继续使用既有记录，还是提供能够表达差异的更具体名称；工具不得改变真实日期来绕过冲突。

#### Legacy 兼容

现有无日期 ID、索引键、关系 target 和资源 owner 保持合法，不自动移动或重写。完整 legacy ID 与语义名称可能具有相同文本时，公开 CLI 必须提供可显式区分 exact ID 与 name 的语法；该语法不得靠“目标恰好存在”建立隐含优先级。

### Resulting Impacts

- **Decision Records：** ID parser、candidate 创建、查询 context、生命周期、关系、stage、CLI 参数与诊断需要接受完整 ID/名称选择并规范化为完整 ID；现有 ID-keyed 索引结构继续派生，不因名称增加第二索引。公开 SDK、声明和 skill 契约同步更新。
- **Investigation Report：** candidate 创建、publish、show、trace、关系、discard、stage-index、资源 owner 与诊断需要共享名称解析；dated 正式报告须校验 ID 日期与 `formedAt` UTC 日期，legacy 报告不追溯施加该门禁。
- **索引与性能：** 当前集合规模允许在已加载索引上做确定性 O(N) exact-name 扫描；不新增名称索引、缓存、registry 或可写映射。未来规模证据否定该选择时，再建立独立性能 Change。
- **长期决策：** 实施前需要演进 Decision 的稳定 ID/ID-keyed 查询契约，并为 Investigation 的日期身份和唯一名称解析建立当前长期判断。
- **分发与验证：** 两个 skill 的行为入口、固定契约、版本、工具源码、生成产物、公开声明和测试必须一致；新增或修改的最小原生测试入口按 Test Evidence owner 逐项登记并同步派生索引。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 六位年份在跨世纪时不自解释 | 当前目标是短、可读且满足现实规模；世纪边界出现真实需求时另行演进，不为远期边界扩大当前 ID |
| 同日同名仍会冲突 | 明确失败并要求更具体名称；该冲突本身是需要人判断是否为同一记录的有效信号 |
| 名称今天唯一、以后可能重名 | 只把名称当输入简写，所有持久关系和索引继续保存完整 ID |
| Legacy ID 与名称简写可能同形 | CLI 提供显式 exact-ID/name 选择，不建立存在优先或 active 优先规则 |
| 两个领域同时修改会扩大实施面 | 只共享可观察契约；代码、事务与测试按领域分组实施和验证，可以分批集成但必须保持同一最终规则 |

## Open Questions

1. 两个 CLI 使用统一的 `--id` / `--name` 显式选择，还是在保留既有位置参数时仅为 legacy 同形场景增加显式选项？进入 Plan 前必须给出每个命令的无歧义语法表。
2. Decision 与 Investigation 的 `new` 是否保留直接传入完整 ID 的兼容入口，还是只允许 name + 日期生成；若保留，如何限制新调用绕过日期格式？
