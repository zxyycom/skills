# Relation Summary Audit

本文件保存 `complete-relation-summary-consumption` Draft 形成时的覆盖率快照和初始消费审计；它不是长期状态 owner，也不替代最终实现后的验证。

## Snapshot

- 日期：2026-09-10（UTC）
- Git HEAD：`13cfa8b1434dca33fed61d11e5a2e33374fbca1c`
- Decision 检查：`bun run decision-records -- check --root .` 通过，346 条已建立决策，派生索引当前。
- Investigation 检查：`bun run investigation-report -- check --root .` 通过，39 份正式报告，完整派生索引当前。

## Coverage

| Domain | Records | Edges | With summary | Without summary | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| Decision（全部） | 346 | 287 | 6 | 281 | 2.1% |
| Decision（active 来源） | 127 | 107 | 4 | 103 | 3.7% |
| Decision（archived 来源） | 219 | 180 | 2 | 178 | 1.1% |
| Investigation（正式集合） | 39 | 21 | 0 | 21 | 0% |

Decision 按关系类型：

| Type | Edges | With summary | Without summary |
| --- | ---: | ---: | ---: |
| 修订 | 162 | 4 | 158 |
| 替代 | 14 | 0 | 14 |
| 判定无效 | 1 | 0 | 1 |
| 归并 | 34 | 2 | 32 |
| 拆分 | 76 | 0 | 76 |

Investigation 按关系类型：

| Type | Edges | With summary | Without summary |
| --- | ---: | ---: | ---: |
| 补充 | 7 | 0 | 7 |
| 复查 | 1 | 0 | 1 |
| 修正 | 13 | 0 | 13 |

统计按当前索引中每个 entry 的 `relations[]` 展开，以 `summary` 字段存在为“有摘要”；空摘要不可能通过当前规范化校验，因此不另设空字符串类别。统计只覆盖已建立 Decision 与正式 Investigation，不含 candidate；快照时两域均无 candidate。

## Existing Summarized Edges

当前 6 条带摘要的 Decision 边是：

1. `260905-separate-persistent-state-from-query-projection` → `maintain-rebuildable-read-side-index-boundary`
2. `260908-maintain-independent-investigation-rounds` → `use-single-investigation-report-core`
3. `260909-incremental-vibe-gate` → `260909-use-native-vibe-gate-controls`
4. `260909-use-native-vibe-gate-controls` → `260909-adopt-vibe-check-0-0-2-gate-runtime`
5. `260909-use-native-vibe-gate-controls` → `activate-release-gate-checks-by-tag`
6. `260909-write-explanatory-relation-summaries` → `260905-add-optional-relation-summaries`

Investigation 当前没有带摘要的正式边。

## Initial Producer / Consumer Matrix

| Path | Decision | Investigation | Current summary behavior | Needs a new display/use decision |
| --- | --- | --- | --- | --- |
| Markdown parse/write | yes | yes | 保存可选 summary，规范化并限制长度 | 是否继续可选 |
| `new` / relation input | yes | yes | 支持按 target 绑定可选 summary | 是否机械要求新边填写 |
| establish/publish relation transaction | yes | yes | 保留或完整替换 summary | preflight 与成功结果是否回显最终边语义 |
| rename | yes | yes | 改 target 时保留 summary | 通常无需新增展示，需验证结果可核对性 |
| derived index / Schema | yes | yes | 投影可选 summary | 是否增加 availability/coverage 投影 |
| `show` / `show-candidate` | yes | yes | 完整 Markdown 中可见 | 是否另给结构化关系结果 |
| `list` | yes | yes | 返回记录；CLI 即使 detail 也不展示关系或 summary | 筛选命中的边和 detail 是否展示 |
| relation filters | yes | yes | 用 type/target 选择记录，不返回“为何命中”的边详情 | 是否返回 matched edge |
| metadata search | yes | yes | 非空 summary 是来源记录的文本段；命中时返回具体边 | 缺失状态和非命中边是否显式 |
| content search | yes | yes | 搜正文；关系筛选与文本证据分离 | 是否保持当前职责分离 |
| `trace` domain result | yes | yes | 透传已有 summary | 由 trace Change 决定图级投影；本 Change 决定缺失语义 |
| `trace` CLI | yes | yes | 有 summary 时条件展示，否则只显示 type/target | 缺失时如何显式表达 |
| mutation success output | yes | yes | 主要报告对象或 source，通常不回显全部边摘要 | 是否需要写后核对视图 |
| diagnostics / check | partial | partial | 校验非法 summary；不汇总历史缺失覆盖率 | 是否增加聚合或 scoped 缺失提示 |
| generated distribution/API types | yes | yes | 随源码投影可选字段 | 最终消费契约改变后同步哪些公开类型 |

“Needs a new display/use decision”不能统一回答为“全部展示”。发现、搜索、写入核对、图追踪和诊断具有不同输出预算与证据责任，Plan 前需逐项形成取舍。
