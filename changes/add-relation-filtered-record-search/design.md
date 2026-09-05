# Design

本设计在两个领域各自的查询流水线中增加直接关系条件，并以同一 index snapshot 完成目标解析、结构筛选和身份反查。

## Context

- 已对齐决策 [`260905-search-authoritative-files-with-index-identity`](../../docs/decisions/search-authoritative-files-with-index-identity.md) 要求领域先用结构化索引缩小 entries，再将显式 `sourcePath` 文件列表交给共享全文搜索，并以同一映射恢复完整 ID。
- Decision Records 的 `list` 与 `search` 已支持重复 tag 的 AND、status 和 alignment；Investigation Report 已支持重复 tag 的 AND、formedAt 范围和一个 relation type。两个领域的 metadata search 都只匹配持久索引 state。
- 每条关系由后继记录保存，`source` 是后继，relation `target` 是直接前序。现有 `trace` 已固定 `predecessors`、`successors` 和 `both` 的方向含义。
- 两个索引 state 都保存完整直接关系。Index Runtime 的保留 `id` 查询字段可以接收领域预先计算的关联 ID 集合，因此无需增加持久反向索引或通用关系查询字段。
- Content search 在持久索引缺失、损坏或不新鲜时，只能从完整合法正式来源建立一次只读临时 snapshot；metadata search 不读取实体，也不 fallback。
- Relation summary 是可选文本说明。Metadata `matchedRelations` 只列实际命中的非空 summary，不承担结构筛选解释。

## Goals / Non-Goals

目标：

- 让两个领域分别按一个已知记录的直接前序、直接后继或两者筛选正式记录。
- 让关系目标、可选关系类型和已有结构条件在全文或 metadata 匹配之前完成确定性交集。
- 保持 selector、结果、错误、分页、limit、fallback 和分发边界由各领域独立拥有。
- 用现有 index state 和 `id` 筛选完成查询，不增加迁移与持久化成本。

非目标：

- 建立跨领域发现入口、共享领域查询 service、跨 skill DTO 或运行时依赖。
- 支持多跳、多目标、布尔表达式、任意关系组合、图相关性排序或新的搜索范围。
- 修改关系方向、边身份、摘要限制、索引 schema、Index Runtime 或候选记录可见性。

## Decisions

### Intended Change

#### Query surface and validation

Decision 的 `DecisionQueryRequest`，以及 Investigation 的 `InvestigationIndexQueryOptions` 与 `InvestigationSearchOptions`，为 `list` 和 `search` 接受下列可选条件：

```ts
relatedTo?: string;
direction?: "predecessors" | "successors" | "both";
relationType?: <本领域关系类型>;
```

CLI 对应 `--related-to <selector>`、`--direction <direction>` 和 `--relation-type <type>`。`direction` 省略时为 `both`；没有 `relatedTo` 时提供 `direction` 失败，因为方向没有可解释的中心记录。`relationType` 可以独立使用，也可以与目标共同使用。每个条件只接受一个值，不引入重复参数或多目标语义。

`relatedTo` 使用本领域普通 selector 规则：先移除一个末尾 `.md`，精确解析 calendar-valid 标准 ID；解析失败才按唯一 name 查找。标准 ID 不存在时不得退回 name。目标从关系查询所用的完整正式 snapshot 解析，不受 status、alignment、tag、formedAt、offset 或 limit 限制；目标本身可以不属于最终返回集合。

#### Direct relation predicate

设目标完整 ID 为 `T`，每条关系边为 `source -> target`：

- `predecessors`：读取 `T` 的 relations，返回满足可选 type 的每个 `relation.target`。
- `successors`：扫描正式 states，返回存在 `relation.target === T` 且满足可选 type 的每个 source ID。
- `both`：合并两个集合并按 ID 去重。

提供 `relatedTo` 和 `relationType` 时，target 与 type 在同一个 relation 对象上判断。不能分别用“记录存在目标边”和“记录存在该类型边”两个独立谓词，否则一条记录中的不同边会产生错误命中。没有 `relatedTo` 时，`relationType` 保持“记录存在任意一条该类型直接边”的语义。

领域实现先计算符合关系条件的 ID 集合，再把它作为 Index Runtime 保留 `id` 字段的 exact-any filter，与已有 tag、status、alignment 或 formedAt filters 一起在排序和分页之前执行。空关联集合直接产生正常空查询结果，不构造无效筛选输入。Decision 不为 relation type 增加新的 query field；Investigation 在目标存在时也不同时应用原有独立 `relation-type` field，避免破坏同边关联。

#### Snapshot and search composition

Decision list 与 Investigation list 分别使用其现有正式 index 查询边界解析目标和计算关联 ID。Investigation 继续让 `id` filter 在 offset、limit 和 total 之前参与 Index Runtime 查询；Decision 继续按 ID 排序并保持 `fullTime` 展示语义。

Content search 在完成现有 snapshot 加载后，用该 snapshot 同时解析目标、计算关系 ID、应用其他结构条件并建立 `sourcePath -> ID` 映射。传给共享 `searchFileText` 的文件列表只来自最终候选记录。进入只读 fallback 时，以上步骤全部改用本次完整验证所得的临时 snapshot，不混用陈旧持久索引。

Metadata search 只加载持久索引，以该索引完成相同的目标解析和结构筛选，然后对候选 state 的既有 metadata segments 匹配文本。关系条件不增加 segment，也不写入 `matchedRelations`；只有 summary 文本真实命中时才保留现有匹配证据。

#### Domain ownership and distribution

两个领域可以复用各自已有 selector、relation type、trace direction 和 Index Runtime `id` filter，但关系条件的准备与错误映射留在本领域查询代码中。本 Change 不抽取共享领域 service；若实现中出现纯数据的小型局部 helper，应留在相应 query owner，并由同一领域的 list/search 共用。

Decision 同步 query types、`cli-args.ts`、CLI help/dispatch、`SKILL.md`、决策规则、人类说明、生成 bundle、source map、SDK declarations 与 skill version。Investigation 同步 `types.ts`、`options.ts`、query、CLI help/dispatch、固定契约、人类说明、公开 declaration source、生成 bundle/declaration 与 skill version。既有 build scripts 只作为生成入口使用，除非实际生成闭包不能覆盖新导出，否则不修改。

### Resulting Impacts

#### Existing behavior and compatibility

- 新参数均为可选；不提供关系条件的 list/search 保持现有行为和结果类型。
- Decision 新增独立 relation type 筛选；Investigation 的独立 relation type 行为保持兼容。只有目标与类型组合时改用同边谓词。
- 目标不存在、name 歧义、非法 type、无目标 direction 和非法方向属于输入失败；合法查询没有关系 match 时成功返回空集合。
- List 与 search 不返回目标解析详情或命中边；调用方需要完整拓扑时继续使用 `trace`。

#### Stable owners and evidence

- `skills/decision-records/references/decision-record-rules.md` 与 `skills/investigation-report/references/investigation-report-contract.md` 分别承接最终查询语义；两个 `SKILL.md` 与人类说明承接使用入口、操作边界及到这些规则 owner 的导航，不成为独立的查询契约来源。
- 已对齐决策已覆盖“结构索引先筛选、权威文件后匹配、同一 snapshot 反查 ID”的长期边界。本 Change 只扩展领域结构条件，不新增或改写长期决策。
- 新增或修改的最小原生测试入口必须分别维护 test-evidence case；聚合 runner 不代替行为证据。
- 索引 definition version、JSON Schema 与持久数据不变；生成制品只反映公开 API、CLI 和文档版本变化。

## Risks / Trade-offs

| 风险或取舍 | 控制 |
| --- | --- |
| 将方向理解为“返回记录自身的方向”会反转结果 | 始终相对 `relatedTo` 解释；测试使用 `successor -> predecessor` 的非对称图分别固定三种方向 |
| 目标和类型由不同边满足会产生假阳性 | 在单个 relation 对象上联合判断，再生成候选 ID 集合 |
| 先分页再做关系筛选会得到错误 total 和漏项 | 关系候选转换为 `id` filter，与其他结构条件共同在排序、offset 和 limit 之前执行 |
| Content fallback 混用陈旧索引会让身份、关系和文件列表不一致 | 目标解析、关系筛选、路径映射和正文文件列表全部来自同一次当前或临时 snapshot |
| Successor 查询需要扫描正式 state | 接受当前 O(N) 读侧成本；只有现实性能证据表明不可接受时再单独评估反向索引 |
| 两个实现形状相似，抽取共享 service 会减少少量重复但耦合领域错误与分发 | 共享行为契约，不共享领域 service；只复用已有 Index Runtime 和文件搜索能力 |

## Open Questions

无。单个目标、三种直接方向、默认 `both`、单个可选类型、同边关联、无目标 direction 失败、结构筛选先于文本匹配以及两个领域独立实现均已确定。
