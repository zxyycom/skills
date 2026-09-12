# Design

按消费任务分配边说明：关系筛选解释命中依据，关系事务支持写入核对，trace 支持局部演进阅读。本文件定义目标契约，[审计附件](relation-summary-audit.md) 保存改前依据，[tasks.md](tasks.md) 记录实施与验证进度。

## Context

- 入口审计确认关系筛选、事务结果和 Decision trace 事件需要补齐表达；其他入口保持各自职责。证据见审计 E1–E8。
- [关系摘要写作决策](../../docs/decisions/write-explanatory-relation-summaries.md) 要求新建或调整真实关系时填写有两端正文依据的摘要。字段约束由 [Decision 关系规则](../../skills/decision-records/references/decision-record-rules.md#演进关系) 和 [Investigation 固定契约](../../skills/investigation-report/references/investigation-report-contract.md) 承接。
- Decision list/lifecycle 服务属于内部表面；Investigation 已公开相关领域 API。两域现有 CLI 的 JSON 模式限于 trace。

## Goals / Non-Goals

目标是让承担边解释责任的入口提供本次判断所需的完整证据，并使省略摘要的入口具有明确的后续读取路径。

范围保持在消费层：沿用摘要可选、单行且最多 40 个 Unicode 码点的数据契约，以及现有边身份、拓扑、trace 选择和预算。历史回填、摘要自动生成、字段必填、长期覆盖率工具和扩大公共 SDK 均不属于本 Change。

## Decisions

### Intended Change

#### P1：列表按关系条件提供边依据

普通 list（含 `--detail`）保持记录概览；使用 `--related-to` 或 `--relation-type` 时，增加 `relation-filter evidence` 块解释导致记录命中的边。依据：E1、E7。

两域分别在查询结果中增加以下投影，类型使用本域的 RelationType：

```ts
type FilterRelation = {
  sourceId: string;
  type: RelationType;
  target: string;
  summary?: string;
};
type RelationFilterContext = {
  filterRelations?: readonly FilterRelation[];
};
```

- **承接位置**：Decision 的内部 list/search 查询记录；Investigation list 的 `{ id, state }` 外层 entry 及 metadata/content search entry。投影属于查询结果，索引记录、Schema 和 Decision 公开导出保持原边界。
- **选择语义**：无关系条件时省略字段；有条件时包含让该记录命中的全部边。related-to 前驱边的 source 是 anchor、target 是结果；后继边的 source 是结果、target 是 anchor；both 取并集。type-only 取结果来源的指定类型出边，组合条件作用于同一条边。
- **快照与顺序**：使用本次筛选所用来源快照的规范 summary；按 `(sourceId, type, target)` 去重并依次按 UTF-16 code-unit 字典序排列。记录集合、排序、total 和分页保持不变。
- **输出预算**：领域结果保留完整数组；CLI 每条记录默认展示前三条，余量输出 `+N more matching relations`。`list --detail` 展开当前页的全部匹配边。边格式与缺省标记见 P4。

关系条件表达了读取边的意图，因此默认提供解释；普通 detail 继续服务记录发现，避免无条件展开全部出边。

#### P2：搜索分开承接文本与关系证据

依据：E2。搜索沿用 P1 的投影与三条预览预算，完整关系可通过现有程序化结果或按显示的 source ID 执行 show 取得。search 的选项集保持不变。

- metadata 的 `matchedFields`、`matchedRelations` 仅承接实际文本命中；`matchedRelations: none` 表示没有关系摘要文本命中。
- content 保留原文 previews；降级读取时，筛选边也从同次内存来源取得。
- 有关系条件时另加 `relation-filter evidence` 块。即使同一条边同时属于两类证据，也保留两个独立块，兼容原有文本证据布局。

#### P3：关系事务返回完整核对结果

适用于 Decision 新候选 activate/evolve、Investigation publish/set-relations。Decision 内部 lifecycle 成功结果和 Investigation 公开 publish/set-relations 结果增加 `relationReview`；各领域分别声明，Relation 沿用本域 `{ type, target, summary? }`。依据：E3。

```ts
type RelationReview = {
  phase: "preflight" | "committed";
  sources: readonly {
    sourceId: string;
    action: "establish" | "replace" | "unchanged";
    before: readonly Relation[];
    after: readonly Relation[];
  }[];
};
type RelationReviewResult = {
  relationReview?: RelationReview;
};
```

**来源与集合**：review 覆盖本次显式选择建立/替换关系的全部来源，按规范 source ID 排列。before 是同次准备读取的原关系：建立时来自候选，替换时来自正式记录；after 是规范化后的完整最终集合。空集合为 `[]`，关系顺序沿用领域规范。仅因事务而归档或改状态的其他记录继续由原动作结果承接。

**动作判定**：新候选采用固定为 establish，包括前后关系相同或均为空的情况。正式来源的规范 before/after（含 summary）完全相同时为 unchanged，否则为 replace。

**变化核对**：renderer 从同一 before/after 按 `(type, target)` 推导 added、removed 及 summary added/changed/removed。移除边展示旧摘要，摘要变化展示 before/after；type 变化表现为移除加新增。建立时显式覆盖候选关系也按此核对。完整替换沿用“未提供 summary 即清除旧摘要”的语义。

**阶段与失败**：适用的预检和正式成功均包含完整 review。preflight 展示预计集合且零写入；committed 表示正式执行已通过事务成功边界。unchanged 明确标注无关系变化，实际写入仍由原有 changed/status 判定。失败沿既有 code、scope、outcome、recovery 表达；失败结果不附成功 review，恢复未完成时不打印已提交集合。

**文本责任**：按 source 分组完整展示最终集合和变化，空集合显式打印 `relations: []`。所选多后继事务保持一个完整核对结果，不应用查询的三条预览上限。review 由领域准备/提交结果提供，renderer 只格式化该结果。

**预检入口**：已有 activate/evolve/publish preflight 使用相同 review。Investigation set-relations 新增 `--preflight`、输入 `preflight?: boolean` 和结果 `preflight: boolean`，缺省 false。true 复用完整准备与校验，Markdown、索引、pending、资源及暂存状态均保持不变；正式执行重新读取并准备，不接受预检作为提交凭据。CLI 继续使用文本输出。

#### P4：边说明保留方向、归属与读取边界

依据：E4、E8。新增筛选/事务行使用 `source --type--> target`；既有 trace 行可以由所在主体和对端共同确定这三个字段。摘要始终保持来源视角。

- 已展示边的摘要以 JSON 转义的完整单行文本输出；已读取但缺省时显示 `[无摘要]`。领域对象和 JSON 仍使用可选 summary，原始 show 保持 Markdown。
- trace 文本注明只展开切片内部边；entry 的完整直接关系可从现有 JSON 或 source 正文读取。`coverage` 继续表达图遍历完整性。
- Decision 事件中，source 有 trace 主体块承接该边时，事件只列拓扑成员；source 仅为 context 时，在事件中逐边显示 source/type/target 和摘要，取代匿名 detail。前驱/后继局部视图的镜像说明保留。
- Investigation 拆分/归并继续按事件对端成员承接摘要，只统一缺省标记与读取边界。

复杂场景以[审计 E8](relation-summary-audit.md#e8) 的输入和选集为验收基础：

| 场景 | 目标摘要承接位置 |
| --- | --- |
| Decision 归并 S→A/B | S 主体分别说明 A/B；事件仅列成员，A/B 镜像保留 |
| Decision 拆分 X/Y→A，Y 为 context | X→A 由 X 主体承接，Y→A 在事件中明确展示 |
| Decision 重划 X→A、Y→A/B，Y/B 为 context | X→A 由 X 主体承接，事件在 Y 下分别说明 Y→A 与 Y→B |
| Investigation 归并 S→A/B，B 为 context | S 的 merge-predecessors 下 A/B 各自承接摘要 |
| Investigation 拆分 X/Y→A，Y 为 context | A 的 split-successors 下 X/Y 各自承接摘要 |

其中 Y→B 两端都为 context，不能因 Y→A 已在别处出现而省略 Y 的整组摘要。同文摘要仍按边保留；无摘要、转义、截断及 JSON 一致性测试见任务 2.4。

#### P5：其他入口按职责选择后续读取

依据：E5、E6。

| 入口 | 保持的结果与读取路径 |
| --- | --- |
| show、show-candidate | 完整 Markdown；正式 API 已有结构关系时继续使用。候选语义审阅以正文为依据 |
| new、candidates/readiness | 路径与准备概览；通过 show-candidate 阅读候选正文和关系 |
| rename 及其 preflight | 身份/位置映射、受影响引用数量；摘要保留由事务回归验证，语义阅读走 show/trace |
| mark-aligned、archive、archived activate | 状态回执；既有关系语义阅读走 show/trace |
| 单独 discard / discard-candidate | 删除对象、引用/资源阻断及恢复范围；evolve 组合删除中的最终关系由 P3 承接 |

#### P6：数据与索引维持兼容

依据：E3、E5、E7。parser/writer、索引和领域对象继续透传可选摘要；check 接受合法缺省，sync-index 与 stage/stage-index 返回原有验证、投影和选择范围结果。

摘要覆盖率基线保存在审计附件。需要解释无摘要边时读取来源正文；新增或调整关系时按写作 owner 填写有依据的摘要。消费输出改进与历史数据补全分别验收。

### Resulting Impacts

| 影响 | Owner 与处理 |
| --- | --- |
| 查询投影与展示 | 两域查询服务及 renderer 实现 P1/P2；Investigation 同步公开 entry 声明 |
| 事务结果与只读预检 | 两域领域准备/提交结果及 CLI 实现 P3；Investigation 同步 options/result 声明 |
| trace 局部表达 | 两域 renderer 实现 P4；图选择、层次、预算、JSON、frontier 和 blockedEvent 保持原契约 |
| 读取和长期取舍 | 两个 skill 的读取指引与固定契约承接 P1–P6；按 Decision Records 流程记录适用两个 skill 的消费取舍 |
| 交付与证据 | tools 源码经现有 scripts 构建适配生成 skill 制品，同步独立版本、测试 Case 与索引；命令见 tasks 和项目工具链 |

## Risks / Trade-offs

- 历史边缺少摘要时仍需阅读全文，消费改进本身不提高数据覆盖率。
- 独立搜索证据块和 trace 镜像会重复少量文本，以保留局部阅读和兼容性；默认查询预览控制额外输出。
- 事务核对可能较长，完整所选集合优先于输出长度。预检与提交之间允许状态变化，正式结果必须来自重新验证的事务。

## Open Questions

无。范围、结果契约、owner 和验收已确定；实施进度由 tasks 管理。
