# Design

先验收历史来源，再以同一非空契约收紧所有已建立记录的输入、投影和维护，并保持候选模型独立。

## Context

行为 owner 为 [Decision Records](../../skills/decision-records/SKILL.md)，源码与生成边界见
[项目工具链](../../docs/tooling.md)。当前 archived/null 经来源解析后在索引省略 alignment，
查询回读为 null，list facets 汇总为 unknown；active 已要求非空。

历史数据由 Change `recall-historical-decision-alignment` 处理。其长期交接为同名
Investigation Report：通过 name 查询获得完整 ID，读取逐项依据与验收结果，并保留上游对本地线索推断的明确不确定性披露。非空字段不代表所有历史值均有原始验证证据。若上游未完成，
执行者先推进该 Change；本 Change 的严格实现与版本切换串行置于数据验收之后。

当前通用索引 schemaVersion 为 4、领域 definitionVersion 为 10、skill 版本为 51；实施时重新
读取基线，版本递增按下述规则，不复用其他并行改动已经占用的版本。

## Goals / Non-Goals

已建立记录统一非空，候选保持合法空值。数据准备、严格实现、验证与分发输入同步属于顺序工作，
不是对历史真实状态的重新定义。

不新增第三种 alignment 或 none 筛选，不重排 list 的全索引统计与分页口径，不保留旧格式 reader，
不自动迁移数据，不修改通用 updater，不发布 Release、推送远端或更新其他项目。

## Decisions

### Intended Change

#### 统一类型与输入契约

| 对象 | alignment 契约 |
| --- | --- |
| candidate 来源 | 必须为 null；createdAt 为 null；不进入正式索引 |
| active/archived 来源 | 必填，且只能为 aligned 或 unaligned |
| 已建立索引条目 | 必填，同一非空枚举，不以字段省略表示状态 |
| 已建立查询 DTO 与 facets | alignment 非空，计数只有 aligned 与 unaligned |

在 `types.ts`、`decision-metadata.ts`、`decision-index-definition.ts` 与
`decision-index-json-schema.ts` 对齐上述要求，删除 `decision-state-snapshot.ts` 的空值省略，
同步 query service、scan 和 renderer 中仅为历史例外服务的 null fallback。

按实际调用图审计所有 consumer；保留真正属于 candidate 或错误诊断的空值，不做全局文本替换。
来源解析失败须指出目标及非法字段；不得跳过已建立非法记录以返回看似完整的集合。

#### 查询与生命周期

- 从 `DecisionListFacets.alignments` 和 list 文本移除 unknown；JSON/公开声明同步收紧，不保留
  始终为零的兼容字段。全索引概览、筛选交集、排序和窗口含义保持不变。
- show、list、search、trace 对合法已建立记录返回非空 alignment；candidate 查询仍走独立入口。
- activate、archive、evolve、mark-aligned、rename、discard 与 stage 沿原有事务边界工作。
  归档保留值，再激活显式确认值；遇已建立非法来源时在写入前失败。
- 旧索引不能作为正常查询依据。已有 content 搜索的来源降级可保留，但只能完整验证当前严格来源
  后构建新投影并报告 warning；这不构成读取旧格式或接受历史空值的兼容路径。

#### 版本与重建

保留 Index Runtime 的 schemaVersion 4；将 Decision Records 的 definitionVersion 在实施基线上
递增一次，当前为 10 → 11；skill metadata.version 同样在基线上递增一次，当前为 51 → 52。
JSON Schema 的版本常量取领域 owner，公开 TypeScript 声明从源码生成，不新增独立 SDK 版本体系。

只有 definition 过期、但 Markdown 满足当前契约时，通过 `bun run decision-records -- sync-index`
全量重建，再严格 check。全量同步从来源建立新投影；不使用需要可信旧索引的 selected 模式，
不改通用 schemaVersion，不为旧 definition 增加 parser 或字段补值逻辑。

来源本身为空时，检查和同步均失败并保持零写入。诊断指明记录/字段以及“先恢复历史来源，后重建
索引”的顺序；只修索引不能解决来源缺口。

### Resulting Impacts

#### 数据前置与使用项目升级

严格代码切换前，读取上游长期报告并重新扫描全部来源，确认逐项召回已完成、当前无 archived/null，
且没有新增空值或未解释漂移。历史数据未验收时，先完成上游，不启用严格实现。

`docs/skills/decision-records.md` 说明升级前先完成历史数据召回并保留 Git 可恢复基线；
skill 的 maintenance-recovery 承接新版诊断后的来源修复与索引重建，规则 owner 承接非空契约。
升级操作仍由使用者显式执行，通用 updater 不检查项目数据，也不为本领域添加专属阻断逻辑。

已经升级但来源尚未准备的项目，保留来源，按可信历史修复后用新版全量同步；证据不足时停止集合
维护，不把回退 reader、忽略非法记录或自动对齐作为恢复动作。本仓库通过不代表其他项目已迁移。

#### Owner、生成与长期交接

运行时修改留在 `tools/decision-records/`；生成文件通过 `bun run sync:decision-records-cli`
同步 MJS、source map、声明与索引 Schema，不直接编辑分发文件。人类说明、skill 规则与恢复说明
按各自职责更新，不在多处复制全部协议。

建立一条自包含的长期决策保存“已建立非空、候选保持 null”的取舍与边界；恢复当前直接相关决策后，
按真实采用方向的变化确定修订关系，保留仍有效的完整含义。不因本次源码或文档修改逐文件建记录。

#### 验证

按 [Test Evidence Review](../../skills/test-evidence-review/SKILL.md) 为修改的最小原生测试节点维护
Case 和派生索引。覆盖两种已建立状态的两个合法值、null/缺失拒绝、候选合法空值、索引重建与
来源非法的区分、查询文本/JSON、归档/再激活、维护零写入及分发入口。

运行领域行为测试、生成一致性、决策和测试证据检查、skill 验证及 `bun run check`。
最终分发输入暂存后运行 `bun run check --tag release --baseline-ref <实施基线>`，确认版本与制品
门禁；该门禁生成本地制品，不代表发布或外部安装生效。

## Risks / Trade-offs

- 这是破坏性契约收紧，使用项目需先修复来源；选择清晰失败而非维持隐式兼容。
- 字段同名不代表生命周期相同；候选类型与 readiness 必须有独立回归证据。
- 不要求共享索引运行时为单个领域更改外壳版本；领域 definition 与 JSON Schema 的必填变化必须一致。
- 上游潜在证据不足阻断严格切换，不以改动本方案或降低门槛绕过。

## Open Questions

无待决设计事项。数据依赖在 Implementation 首项验收；未完成时先推进上游，不能勾选数据验收或发布门禁。
