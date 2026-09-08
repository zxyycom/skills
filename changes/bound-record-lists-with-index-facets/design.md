# Design

本 design 让两个领域从同一次已加载索引 snapshot 聚合完整筛选 facets，并把 `list` 固定为展示最近有界记录的发现入口；产品结果和范围以 [`proposal.md`](proposal.md) 为准，[`tasks.md`](tasks.md) 只安排本文已经闭合的实施与验证。

## Context

- Decision 当前默认 list 过滤 active 后按 ID 升序返回全部 123 条，并为每条渲染状态、alignment、日期、ID、sourcePath、tags、title 与 purpose。
- Investigation 当前 list 已支持 tag、formed 时间、直接关系、默认 50/最大 1000 的 limit 及 offset，但按 ID 升序且每条渲染 ID、完整 formedAt、title、question 与 tags。
- Index Runtime reader 在打开当前索引时物化完整 entries 和查询字段；两个领域的 list 查询本来就对该内存集合执行筛选与排序。Facets 可以从 `reader.all()` 的只读 entries 聚合，而无需读取 Markdown 或修改共享运行时。
- Decision 的 `createdAt` 与 Investigation 的 `formedAt` 都是受检非空时间戳；Investigation 已将 `formed-at` 声明为 range query field。Decision 为保持 definition identity 与当前索引不变，在领域 list query 中对已加载 entries 完成时间范围、排序和分页，不新增持久定义字段。
- 默认 list 的主要消费者是人类与 agent 的记录定位；完整语义已经由 `show`、正文搜索和关系 trace 分层承接。
- 当前 tags 分别有 23 和 25 个、UTC 月份分别有 4 和 3 个；它们远小于记录集合，但仍需显示上限，避免长期增长后把 facets 变成第二个全量清单。
- 持久 metadata 会与现有 selected sync/stage 的 collection state 契约冲突。用户已确认统计可以在查询时发生，因此本 Change 不再修改该边界。

## Goals / Non-Goals

目标：

- 让调用者从同一索引 snapshot 看到有哪些稳定筛选维度和值，而不读取权威 Markdown。
- 让默认 list 在集合增长到千级时仍保持有界，并优先暴露最近形成的记录。
- 让筛选概览、匹配窗口和完整正文分别由 query facets、paged entries 与 `show` 承担。
- 让两个领域共享一致的交互模型，但保留各自 lifecycle、alignment、时间字段和多行投影差异。
- 保持索引、生成物、说明和测试证据的一致性。

非目标：

- 不修改 Index Runtime 或持久 metadata，不建立跨领域 facet Schema、renderer 或通用聚合 API。
- 不计算当前过滤结果的动态 facets，不把全局 snapshot facets 误标成匹配集合统计。
- 不改变全文搜索、单项读取、关系追踪、候选或维护事务的领域语义。
- 不增加无限输出开关、cursor、sort option、tag registry、月份实体或目录分片。

## Decisions

### Intended Change

#### Domain-owned query facets

两个领域分别定义公开的只读 facets DTO，字段表达下列等价信息：

```ts
type TagCount = { tag: string; count: number };
type MonthCount = { month: string; count: number }; // UTC YYYY-MM
type TimeSummary = {
  earliest: string | null; // canonical UTC instant
  latest: string | null;   // canonical UTC instant
  months: MonthCount[];
};

type DecisionListFacets = {
  recordCount: number;
  statuses: { active: number; archived: number };
  alignments: { aligned: number; unaligned: number; unknown: number };
  tags: TagCount[];
  createdAt: TimeSummary;
};

type InvestigationListFacets = {
  recordCount: number;
  tags: TagCount[];
  formedAt: TimeSummary;
};
```

`unknown` 只计数历史 archived `alignment: null`，不是新的 Decision alignment。固定计数对象始终保留零值；tag 与 month 数组只保存正计数。Tags 按现有领域 token 比较升序且唯一；月份按 `YYYY-MM` 升序且唯一。

时间先按已有 parser 的合法 instant 处理，再以 UTC 规范化。`earliest` 与 `latest` 保存 `Date#toISOString()` 等价的 canonical UTC instant；每条记录只按该 instant 的 `YYYY-MM` 计入一个月。空集合的两个边界都是 `null`，数组为空，计数为零；不存在第二种空表示。

领域 list query 打开一个 reader 后先从 `reader.all()` 聚合 facets，再在同一 reader 上执行结构筛选、排序与分页。聚合不读取 Markdown、不重新打开索引、不改写 metadata，也不依赖调用者当前 filters；它描述的是该 reader 的完整已发布 index snapshot。Renderer 只消费 query result，不自行读取或重新聚合。

两个领域各自实现窄 builder，不在 Index Runtime 新增 facet 类型或 aggregation API。若现有领域内已有精确承接无领域语义的 canonical primitive，可以复用；不得为了消除少量同形代码建立新的共享协议。

#### Global facets versus matched results

list 返回并渲染两个不同范围：

1. `Index filters` 来自完整 reader snapshot 的 facets，不随本次 status、alignment、tag、time 或 relation filters 改变。
2. `Latest matches` 来自本次结构化查询，`total` 是应用全部过滤器后的匹配数，entries 只是其中的 limit/offset 窗口。

输出列出当前 `Applied filters`。不能把全局 tag count 解释为当前筛选集合中的共现统计，也不为筛选组合预计算交叉计数。

默认 facet preview 固定为：Decision 的全部 status/alignment 计数、记录总数与时间边界，加最多 30 个 tags 和按时间倒序最近 10 个 UTC 月份；Investigation 使用同一 preview 上限但没有 status/alignment。Tag preview 按 count 降序、tag 升序打破平局；month preview 按 month 降序。被省略的 tag 或月份只显示剩余 distinct value 数量。`--detail` 展示 facets 中的全部 tags 和月份，排序规则不变。

#### Recent paged query

两个领域的 list 默认窗口为：

```text
limit = 10
offset = 0
maximum limit = 1000
```

Decision 增加 singleton `--limit <count>`、`--offset <count>`、`--created-from <timestamp>` 与 `--created-to <timestamp>`；时间边界为 inclusive，并与 status、alignment、重复 AND tag、直接关系条件组合。Investigation 保留既有 `--limit/--offset` 和 `--formed-from/--formed-to`，只把默认 limit 从 50 调整为 10。

Decision 在领域 list query 中按合法 timestamp 的 instant 完成范围过滤、排序与分页；Investigation 复用现有 `formed-at` range query field。实际 sort 分别为：

```text
Decision:      created-at desc, id asc
Investigation: formed-at desc, id asc
```

ID tie-break 让同一 snapshot 内分页稳定。实现不暴露 `--sort` 或 `--order`。Offset 超过匹配总数时仍成功返回空窗口，并保留 facets、matched total、limit 和 offset，不能退化成无法区分“集合无匹配”和“页已越界”的无上下文消息。

Decision 的 list success result 变为包含 `facets`、`records`、`limit`、`offset` 与 `total` 的对象；Investigation 的既有 query result 增加 `facets`。两者的结构化 query request/result 不携带 `detail` 等显示选项；CLI renderer 只消费 query result 和独立显示选项。生成的 Decision 声明与 Investigation 公共类型同步修改。

#### Compact and detailed rendering

两个 CLI 都增加一个无值的 `--detail`，且只允许用于 `list`。它不改变过滤器、sort、limit、offset、facets 或结构化 query result，只选择 renderer 展示密度。

默认 compact record 不截断已选择字段：

```text
Decision:      <id> <created date/full-time> <status>/<alignment-or-null> [<tags>] <title>
Investigation: <id> <formedAt> [<tags>] <title>
```

Decision 的现有 `--full-time` 继续只决定 compact 或 detail 中 createdAt 的日期/完整时间表示。

`--detail` 保留当前每条记录的多行字段：Decision 显示 header、sourcePath、tags、title、purpose；Investigation 显示 ID/formedAt、title、question、tags。默认与 detail 都先显示 Index filters、Applied filters 和 Latest matches header，结束时显示 `showing <count> of <total>, offset <offset>, limit <limit>` 及可计算的 remaining/next offset 提示。

`sourcePath`、purpose、question、background、decision、relations 与正文不进入 compact 行；调用者按返回完整 ID 使用 `show` 或 `trace`。Renderer 不截断 title、tag 或时间文本。

#### Contracts, versions, and performance evidence

Decision Records 与 Investigation Report 的行为入口、固定规则/契约及适用的人类说明同步描述：list 是全局索引筛选概览加近期定位窗口，facets 在查询时从已加载 snapshot 聚合，`--detail` 是显式长输出，`show` 才是完整语义入口。两个 skill 独立递增 metadata version，具体版本号以集成时基线为准。

建立一条覆盖两个领域的长期 Decision，保存“查询时聚合全局筛选 facets、默认近期有界 list、detail 显式展开”的方向；Change 只保留具体 preview 数量、字段排版和实施顺序。该 Decision 不改变各领域 Markdown 与 index 的单向派生关系。

性能证据使用领域 query 测试或窄基准覆盖当前集合量级与至少 10,000 条的合成 snapshot；验证聚合是单次线性遍历、不读取实体文件，且不会改变 limit 之前的完整 facets。测试不建立不稳定的绝对毫秒门槛，除非仓库已有可靠性能阈值约定。

### Resulting Impacts

#### Query and presentation compatibility

Investigation 的 limit 最大值与 offset 语义保持不变，默认值从 50 改为 10。Decision 新增同等分页字段，不再有默认全量 list。两者默认排序从 ID 升序改为领域时间倒序；这是有意的发现行为变化，依赖旧文本形状或全量顺序的调用者必须改用结构化 API、显式窗口或 `--detail`。

`--detail` 只兼容现有单条多行字段，不承诺整个旧 stdout 逐字不变：新的 facet/header/footer、时间排序与分页仍然存在。CLI help、skill 说明和测试必须避免把它描述成无限或 legacy mode。

#### Snapshot and runtime boundaries

Facets 与 matches 必须来自同一 reader。若领域现有 API 分开打开 reader，应重排为一次打开后完成 `all()` 与 `query()`，而不是依赖两次可能跨 revision 的调用。返回对象使用不可变或调用方隔离的普通值，不暴露 reader 内部缓存。

持久 index metadata 继续是严格空对象。`tools/index-runtime/`、index JSON Schema、definition identity 和来源 fingerprint 都不因列表实现修改；Investigation 当前 index JSON 保持无 diff，Decision 当前 index JSON 只接受本 Change 新建长期 Decision 的规范 entry/revision 变化。最终 diff 与生成检查必须显式证明没有其他索引变化。

#### Owner and generation boundaries

领域 facets 类型、聚合、query 与 renderer 留在各自 `tools/` owner。Build scripts 只机械生成现有 bundle、source map 和声明；若无需改变生成闭包，不能顺手修改 build adapter。

测试记录按最小原生节点维护 Case；现有 list Case 如语义变化就更新，新增节点才增加新 Case，避免按文件或聚合命令复制证据。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 全局 facets 在有筛选的 list 中可能被误读为当前结果 facets | 固定 `Index filters` 与 `Latest matches` 两个范围，显示 Applied filters，并在 skill/CLI help 明确 facets 不随查询组合变化 |
| 查询时聚合增加一次 O(N) CPU | 复用已加载 entries，不读 Markdown 或索引第二遍；用当前规模与 10,000 条合成集合验证线性路径，只有现实瓶颈出现后再评估物化 |
| 默认 10 条可能不足以完成一次定位 | `--limit` 可显式提高到 1000，tag/time/relation filters 可收窄，完整对象继续用 `show` |
| Offset 在两次查询之间遇到索引变化可能跳项或重复 | list 是当前持久 snapshot 的交互浏览，不建立 cursor；严格批处理一致性需要固定同一 index revision 或重新查询 |
| UTC 月份与源时间戳显示的本地月份在边界时可能不同 | Facets 明确标注 UTC，先规范化 instant 再分桶；范围过滤仍按 instant，不按字符串前缀 |
| `--detail` 仍可能产生较长输出 | 它是显式 opt-in 且继续受 limit 约束；facet preview 默认有界，完整正文不进入 list |
| 两个领域局部实现相似统计代码 | 字段、lifecycle 与展示并不相同；少量领域内 builder 比无现实第三方的共享 facet 协议维护面更小 |

## Open Questions

无。
