# Proposal

本 proposal 规划让 Decision 与 Investigation 的 `list` 直接从已加载索引 entries 聚合筛选概览，并默认只显示最新的有界紧凑结果，同时用 `--detail` 保留现有多行投影。

## Why

当前 Decision 索引包含 336 条已建立记录，其中默认 `list` 匹配 123 条 active 并输出 616 行、约 41 KB；Investigation 当前 38 条报告的默认 `list` 输出 153 行、约 10 KB。Decision 尚无分页，Investigation 虽已有默认 50 条的 `--limit/--offset`，但每条仍固定展开多行，而且两者都按 ID 升序，集合超过默认窗口后会优先展示旧记录。

调用者需要先知道集合有哪些可用 tag 和时间范围，再按条件定位少量近期记录；全量展开每条路径、目的或问题既占用终端与 agent 上下文，也把 `list`、`search` 和 `show` 的责任混在一起。

两个索引的 entry 已包含统计所需的领域字段，reader 在一次查询中也已物化完整索引。筛选概览可以从同一不可变内存 snapshot 聚合，不读取 Markdown、不改变索引 metadata 或 Schema，也不引入会破坏 selected sync/stage 的集合状态特例。

## Outcome

- Decision 与 Investigation 的 `list` 从一次已加载的完整索引 entries 聚合记录计数、tag 计数、UTC 月份计数和时间边界；Decision 另外聚合 status 与 alignment 计数。
- 两个 `list` 默认展示有界筛选概览和按 `createdAt` / `formedAt` 倒序排列的最新 10 条匹配记录，并报告匹配总数、offset 与剩余范围。
- 默认记录投影为一条不截断的定位行；`--detail` 在相同筛选、排序、limit 与 offset 下保留当前多行投影，并展开完整筛选目录。
- Decision 获得与 Investigation 对齐的 `--limit/--offset` 以及 `--created-from/--created-to`；Investigation 保留现有 `--formed-from/--formed-to`。
- Index Runtime、持久索引 metadata、definition version、selected sync 和 selected staging 契约保持不变。

## Scope

### Intended Change

- 在 Decision 与 Investigation 各自的 list query 中，对 reader 已加载的完整 entries 确定性聚合严格 facets DTO；聚合发生在筛选和分页窗口之外，但与结果共享同一 reader snapshot。
- 让两个 list query 返回 facets、匹配总数、limit、offset 和领域时间倒序结果；Decision 增加创建时间范围过滤，Investigation 复用现有形成时间范围过滤。
- 默认 `list` 渲染有界筛选概览和最新 10 条紧凑单行记录；增加 `--detail`，在不改变查询窗口的前提下保留现有多行记录字段并展示完整筛选目录。
- 同步生成的 CLI 与声明、skill 行为和固定契约、独立版本、适用的人类说明、长期决策和测试证据。

### Resulting Impacts

- list query 的公开结果形状会增加 facets 与分页上下文；Decision 从无界 entries 结果升级为分页结果，现有调用方与生成声明必须同步。
- `list` 默认顺序、默认条数和文本形状会变化；现有精确对象读取继续由 `show` 承担，`--detail` 只保留多行字段而不恢复旧的无界顺序。
- Decision 的 `createdAt` 范围过滤、时间排序与分页在领域 list query 的已加载 entries 上完成；Investigation 复用既有 `formed-at` 字段。两个领域使用时间降序加 ID 升序 tie-break，保证同一 snapshot 内分页稳定。
- 默认筛选概览必须有独立显示上限，避免 tag 或月份集合成为新的无界输出；`--detail` 是显式长输出入口，但仍受记录 limit 约束。
- 每次 list 会对已物化的完整 entries 增加一轮 O(N) 聚合；这不增加 Markdown 或索引磁盘读取，且需用现有规模与放大规模测试确认资源边界。
- 新增或修改的最小原生测试入口需要逐项维护 test-evidence Case，并同步派生测试索引。

### 非目标

- 修改 Index Runtime、持久索引 metadata、索引 Schema/definition version、来源 revision 或 selected sync/stage。
- 按年、月、tag 或 lifecycle 拆分 Markdown 目录、派生索引或关系图。
- 为当前筛选组合预计算交叉 facets，或让概览声称反映过滤后的动态共现统计。
- 修改 Decision / Investigation 的身份、关系、生命周期、候选、正文、资源或写入授权语义。
- 修改 `search`、`show`、`trace`、`candidates` 的结果窗口和文本协议，或增加 ranking、模糊搜索、cursor、可配置排序和通用查询语言。
- 在共享层建立 facet Schema、聚合 API 或 renderer；两个领域拥有各自的字段、统计与显示语义。
- 用自动归档、字段截断或终端 pager 隐藏集合增长。

## Success Criteria

- 两个领域对同一 reader snapshot 重复查询会产生深度相等的 facets；每个 tag 计数一次携带该 tag 的记录，每个时间戳按对应 instant 的 UTC `YYYY-MM` 计入一个月份，空集合使用零计数、空列表和空时间边界的唯一表示。
- 常规 list 只打开索引一次，不读取 Markdown、不改写索引，也不把 facets 写入 metadata；Index Runtime、索引 Schema/definition version 和两个索引的空 metadata 保持不变。Decision 当前索引只因本 Change 建立的长期记录增加对应 entry。
- 两个默认 list 都按领域时间降序、ID 稳定打破平局，最多返回 10 条紧凑记录，并明确显示 `Index filters`、`Applied filters`、匹配总数、limit/offset 范围和仍有多少结果。
- 默认概览展示完整固定低基数字段、最多 30 个 tags 和最近 10 个 UTC 月份，其余值只报告剩余 distinct value 数量；`--detail` 展示完整 tag/月目录及现有多行记录字段，但不会绕过 `--limit`。
- Decision 的 status、alignment、tag、created 时间、关系、limit 与 offset 可以组合；Investigation 的 tag、formed 时间、关系、limit 与 offset 保持可组合，越界或重复参数继续得到稳定参数错误。
- `show` 仍是完整正文入口；紧凑列表不截断任何已选择展示的字段，也不改变索引投影字段自身的长度与内容。
- 现有规模与代表性放大规模验证证明查询时 facets 聚合不改变 reader snapshot 语义且资源开销可接受。
- 源码 API、CLI、生成声明、bundle、source map、skill/人类说明、长期决策和 test-evidence 账本保持一致，并通过目标测试、生成一致性检查、领域集合检查与 `bun run check`。

## Affected Owners

| Owner | 本 Change 的责任 |
| --- | --- |
| [`tools/decision-records/`](../../tools/decision-records/) | Decision facets 聚合、created 时间查询、分页结果、CLI 参数和紧凑/详细 renderer |
| [`skills/decision-records/`](../../skills/decision-records/) | 生成 CLI/声明、agent 查询路径、固定规则与独立 skill 版本 |
| [`tools/investigation-report/`](../../tools/investigation-report/) | Investigation facets 聚合、近期分页结果、CLI 参数和紧凑/详细 renderer |
| [`skills/investigation-report/`](../../skills/investigation-report/) | 生成 CLI/声明、agent 查询路径、固定契约与独立 skill 版本 |
| [`scripts/build/decision-records.ts`](../../scripts/build/decision-records.ts) 与 [`scripts/build/investigation-report.ts`](../../scripts/build/investigation-report.ts) | 从维护源码重建分发制品；只有现有生成边界不能覆盖新导出时才修改适配器 |
| [`docs/decisions/`](../../docs/decisions/) | 保存查询时筛选概览、近期有界 list 与 detail 分层的长期方向，并同步该记录的派生索引 entry |
| [`docs/skills/`](../../docs/skills/) | 只在现有人类说明承接查询行为时同步默认 list、筛选和 detail 入口 |
| [`docs/test-evidence/`](../../docs/test-evidence/) | 为所有新增或修改的最小原生测试入口维护 Case 并同步派生索引 |
