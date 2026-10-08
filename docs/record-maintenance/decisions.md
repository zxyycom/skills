# 决策维护工作流

审查 `docs/decisions/` 中的 active 与 archived 决策，恢复采用方向、理由、约束及演进。语义和事务以 [Decision Records](../../skills/decision-records/SKILL.md)及其[规则](../../skills/decision-records/references/decision-record-rules.md)为准。

按[公共流程](../record-maintenance-workflow.md)选择 `DOMAIN=decision`，使用[任务模板](decision-run.template.json)和[主代理审查清单](decision-review.json)。本页定义领域检查、处置及验收。

## 1. 恢复采用与当前依据

1. 运行 `bun run decision-records -- check`，检查身份、生命周期、关系和索引；已知合法编辑按领域规则先同步。
2. 读取所选完整记录，分别保留目的、背景、采用方向、status、alignment 和直接前序。列表默认 active，检查历史时显式选择 archived。
3. active 决策取得当前规范、实现或执行证据；aligned 看完整已对齐方向的具体偏离，unaligned 分别检查未来方向仍适用的依据、完整方向是否已经实现。archived 按采用历史解释，不承担当前实现对齐检查。
4. 候选对取显式关系、普通记录引用、共同 owner 及共同约束对象／行为检索命中的并集；同领域且至少一端为所选记录，按无序对去重。题库 `preparation.pairContext` 固定恢复共同适用条件；检索词、命中与截断写入 discoveryEvidence。
5. 增量审阅补入直接邻居、完整拆分／归并／重划事件及受当前 owner 变化影响的决策。候选覆盖和事实缺口单列。

## 2. 生成固定检查

一组 `inputs` 对应一个 `job`，完整正文含 frontmatter。主代理按下表登记问题，逐步读取本地材料并保存判断依据。

| 维度 | 模板与固定题目 | 主代理所需材料 |
| --- | --- | --- |
| `content` | `record`：`decision_summary`、`decision_consistency`、`decision_rationale`、`decision_record_value` | 完整正文、采用理由和记录价值；按采用时期判断长期取舍，不把任务或执行结果当作决策 |
| `boundaries` | `record`：`decision_boundary`；`pair`：`decision_pair_conflict`、`decision_pair_redundancy` | 单条完整方向；两份正文及共同适用条件 |
| `tags` | `tag`：`tag_support`、`tag_redundancy` | 按 `preparation.tagCandidates` 列全部既有标签及有正文依据的候选，填写含义和检索用法；otherTags 包含其他既有与候选标签 |
| `relations` | `pair`：`decision_missing_relation`；`relation`：`decision_relation_type`、`decision_relation_summary` | 对候选对先查真实直接承接是否漏记，再检查全部既有入边、出边；取得两端正文、必要采用历史及类型定义，source 为后继 |
| `evolution` | `event`：`decision_event_coverage` | 完整直接前序和后继、成员依据；相同事件去重 |
| `applicability` | `applicability`：`decision_applicability`、`decision_alignment_completion` | active 与当前事实内容、版本、时点及证明边界；completion 仅检查 active + unaligned，逐项核对完整方向 |

身份、字段、图结构和成员完整性用代码核对。不适用项按以下条件登记：

- 可选摘要缺失：仅摘要题不适用。
- archived：适用性检查不适用；完整实现检查仅用于 active + unaligned。
- 无现存边：既有边检查不适用，候选对的缺边检查仍执行。候选或成员未取全记覆盖缺口。

### 可选局部辅助

按 [JEV 规则](jev-local-judgment.md)，`topic_match` 可辅助 `tag_support` 的一处原文依据，`statement_support` 可辅助 `decision_summary` 的一条摘要断言。主代理继续检查整篇主题、摘要完整性、遗漏和条件变化；其余领域判断直接完成。

## 3. 整合决策处置

| 已复核发现 | 调整方式 |
| --- | --- |
| 摘要误述、已有理由或边界表达不足 | 在采用方向和范围不变的前提下完善原记录，保留原来的真实取舍 |
| 不满足长期决策记录门槛 | 区分误建记录与仍有真实采用历史的记录；提出收敛或获准清理方案，不把今天失效等同于没有历史价值 |
| 实际采用方向、范围或核心取舍改变 | 判断是否形成可独立回放的新决策；有真实直接承接时再建立关系 |
| 同一记录含可分别修订、归档或对齐的方向 | 提议自包含后继及逐项承接方案；不可独立演进的局部落地仍作为整条判断处理 |
| 共同适用的约束冲突 | 明确冲突条款和需要决定的取舍；双方各有独有价值时分别保留，冲突不等于冗余 |
| 重复判断 | 核对独立采用历史与回放价值，再决定原地收敛、归并或获准删除 |
| 关系遗漏、误述或事件承接不全 | 为每个 source 列完整最终关系；只改关系用 set-relations，生命周期联动按 evolve |
| aligned 与当前事实偏离 | 报告一致性问题并保留已核对的对齐历史；区分文书误述、实现问题和新未来方向 |
| unaligned 的完整方向已实现 | 完整核对后用 mark-aligned；实施差异本身不是未来方向的记录错误 |
| 标签缺依据或同义重复 | 纠正既有值或拒绝新增；保留至少一个有效标签。新增须同时有主题依据和检索收益 |

动作 kind 为 `edit_tags`、`edit_text`，或领域的 `publish`、`evolve`、`set-relations`、`mark-aligned`、`archive`、`reactivate`、`rename`、`discard`。实际创建、演进、状态变更与删除按领域门槛及本轮授权执行；同一字段或事件的发现合成一个 action。

## 4. 验收

- 每个适用检查有结论或未决项；JEV 抽样分为 active、archived 两层。
- 按公共流程核对来源版本、最终 diff 和项目检查，并完成领域同步、全量 check 与关系承接复核。
- 交付分别说明记录准确性、当前实现事实和实际生命周期／对齐变更。
