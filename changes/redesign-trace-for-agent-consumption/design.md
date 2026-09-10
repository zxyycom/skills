# Design

本 Draft 以 agent 的单次查询消费为主线，设计共享查询 envelope 与领域索引切片，并保留待进入 Plan 前确认的精确契约。

## Context

- `decision-records trace` 与 `investigation-report trace` 都从受检派生索引遍历关系，但领域字段和现有 CLI 结果形态不同。
- Decision entry 已包含 title、status、alignment、createdAt、purpose、background、decision、tags 与 relations；Investigation entry 已包含 title、formedAt、question、tags、relations、资源和定位字段。领域 entry 是 trace 语义的现成投影。
- 原始 relation 位于后继 entry 中并指向直接前序。ID 键控且关系闭合的 entries 子集足以表达本次查询中的 DAG。
- 主遍历成员按 direction 与 depth 递归选择；事件上下文补全已选拆分、归并或重划事件的其他端点，并保持非递归成员身份。
- 当前索引中，Decision 最大单向 trace 为 48 条记录、最大双向连通分量为 65 条、最大拆分事件有 4 个后继；Investigation 最大双向连通分量为 19 条。深度 5 与 50 条记录可覆盖普通查询，并为较大图保留显式续查边界。
- relation summary 的生产和覆盖由独立 Change `complete-relation-summary-consumption` 负责；本 Change 只投影同一索引快照中已有的 relation 字段。
- [trace-output-examples.md](trace-output-examples.md) 保存讨论原文，供核对设计来源和边界；本文件是当前设计选择的 owner。

## Goals / Non-Goals

目标：

- 让 agent 一次取得可直接遍历的领域索引切片。
- 区分主遍历成员与关系事件上下文，并让成员身份在结果中可检查。
- 明确表达查询限制、覆盖状态、事件原子阻断和续查边界。
- 以完整拆分、归并或重划事件作为最小语义单元。
- 共享查询与覆盖 envelope，同时保留 Decision 与 Investigation 各自的 entry 字段。

范围边界：

- 权威内容仍由 Markdown 及其受检索引承接；`trace` 使用单个索引快照，不加载 Markdown 正文。
- 关系方向、关系类型、图合法性和跨领域边界沿用各领域现有契约。
- relation summary 按索引现状投影，其生产规则由对应独立 Change 承接。
- 结果模型采用领域 entries，不增加通用 TraceNode、独立 edges、路径枚举、拓扑 layers 或持久反向 adjacency。
- CLI 的成功输出采用单一 JSON 协议；仓库内消费者随该不兼容变更同步更新。

## Decisions

### Intended Change

以下为 Draft 当前选择；字段级结构和仍待确认的行为列在 `Open Questions`：

1. 领域 API 返回 ID 键控的索引切片，CLI 对同一结果做稳定 JSON 序列化。
2. 顶层 envelope 包含 anchor、direction、实际 limits、coverage、`traceIds`、`contextIds`、续查边界和 `entries`。
3. 每个选中 ID 在 `entries` 中恰有一个 entry；`traceIds` 与 `contextIds` 互斥。context member 后续进入主遍历范围时提升为 trace member。
4. direction 选择 `predecessors`、`successors` 或 `both`；depth 默认 5，仅计算主遍历跳数；`max-records` 默认 50，计算两类成员并集中的唯一记录数。
5. 事件闭合包含纯归并的全部直接前序、同一前序的全部拆分后继，以及完整重划连通分量的全部前序和后继。普通一对一演进无需额外 context。
6. 完整事件是记录预算的原子单元。下一事件超出预算时，选择停在事件边界，并返回该事件及继续所需的最小容量。
7. coverage 区分完整结果、depth 截断、一般记录预算截断和事件原子阻断；frontier 提供继续查询所需的边界事实。`complete=true` 表示请求方向没有未展开关系，且已选事件上下文完整。
8. `entries` 直接投影同一索引快照中的原始 relation。范围外 relation target 通过 coverage 与 frontier 解释，不扩充为独立 edge。
9. 字段裁剪由领域 adapter 负责。当前候选是 Decision 删除派生 `name` 与定位 `sourcePath`，Investigation 再删除 `resourceIds`；tags 与领域核心摘要保留。

### Resulting Impacts

- 共享 relation graph 查询需要表达遍历成员、上下文成员、frontier、覆盖原因和原子事件阻断；领域 adapter 继续负责事件语义与 entry 裁剪。
- Decision 与 Investigation 的 trace 结果类型和 CLI 输出采用单轨切换；仓库内文本输出消费者与断言同步改用 JSON envelope。
- 两个领域的事件闭合分别复用现有拆分、归并和重划规则，CLI 序列化层只呈现查询结果。
- 固定契约、`SKILL.md`、CLI help、生成 MJS、类型声明和查询测试需要同步默认值、输出结构与完整性语义。
- 工具源码、分发产物和测试变更完成后，按测试证据 owner 更新受影响的最小原生测试入口 Case。

## Risks / Trade-offs

| 风险或代价 | 设计控制 |
| --- | --- |
| 默认限制截断较大关系图，agent 可能误判完整性 | coverage 明确限制原因，frontier 提供续查边界，并用查询测试覆盖完整性判断 |
| 大型拆分或重划事件需要高于默认值的记录预算 | 以事件为原子单元阻断，并返回继续所需的最小容量 |
| 字段裁剪过多会增加后续读取，裁剪过少会增加 token 成本 | 进入 Plan 前确定各领域字段清单，并验证典型 trace 任务所需信息 |
| JSON 单轨切换会影响现有文本消费者 | Readiness 阶段定位仓库内消费者，实施与断言在同一 Change 中同步更新 |
| 反向遍历和同层事件竞争会影响结果的确定性 | 进入 Plan 前固定 frontier 事实、选择顺序和预算规则 |

## Open Questions

1. `--direction` 是必填参数，还是提供一个有限的默认方向？
2. coverage、frontier 与 blocked event 使用哪些精确字段，CLI 如何表达成功、受限与容量不足？
3. `--max-records` 的合法范围和硬上限是什么；容量不足以容纳 anchor 或首个完整事件时返回哪类结果？
4. Decision 与 Investigation 的字段裁剪清单是否只包含当前候选字段？
5. successor frontier 需要保存哪些查询事实；同层多个事件竞争预算时采用什么确定性顺序？
