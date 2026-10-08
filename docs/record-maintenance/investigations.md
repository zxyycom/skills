# 调查报告维护工作流

审查 `docs/investigations/` 的正式报告及资源，让读者能复核当时的问题、证据、认识转折、结果和边界。语义和事务以 [Investigation Report](../../skills/investigation-report/SKILL.md)及其[固定契约](../../skills/investigation-report/references/investigation-report-contract.md)为准。

按[公共流程](../record-maintenance-workflow.md)选择 `DOMAIN=investigation`，使用[任务模板](investigation-run.template.json)和[主代理审查清单](investigation-review.json)。本页定义领域检查、处置及验收。

## 1. 恢复调查轮次与材料

1. 运行 `bun run investigation-report -- check`，检查身份、正文结构、关系、资源和索引；已知合法报告编辑按领域规则先同步。
2. 读取所选全文及其问题、formedAt、来源版本、实际动作、样本和未覆盖范围。依据按实际取得时点区分；正文应独立承接关键认识，资源提供复核细节。
3. 按本轮维度取回所引用的关键证据和随附资源，保存内容、版本、来源、取得时点和处理方式。材料无法取得时登记缺证；路径存在本身只证明可定位。
4. 候选对取直接关系、普通报告引用及同一问题／现象检索命中的并集；同领域且至少一端为所选报告，按无序对去重。用 `preparation.pairContext` 对照形成条件、方法和认识，保存检索依据与覆盖边界。
5. 本轮报告维护检查其形成时认识是否被准确记录。只有当前请求或项目规则要求重新调查时才开展事实复查；新版本结果另按轮次边界记录，不回填为旧轮次已取得的证据。

## 2. 生成固定检查

一组 `inputs` 对应一个 `job`。主代理按下表登记问题，保存判断依据；前提、结论及证据摘录均须定位回完整报告。

| 维度 | 模板与固定题目 | 主代理所需材料 |
| --- | --- | --- |
| `framing` | `record`：`investigation_context`、`investigation_question` | 每份所选报告全文，恢复形成背景、初始问题、实际范围及认识收窄 |
| `conclusions` | `record`：`investigation_conclusion`、`investigation_consistency` | 完整结果与所述依据，核对内部自洽并区分事实、推断、建议、动作及未知 |
| `evidence` | `evidence`：`investigation_source_fidelity`、`investigation_evidence_coverage` | 按 `preparation.evidenceClaims` 枚举影响问题、范围、候选集的关键前提与结论主张，每项一组 inputs，附实际来源、版本、时点、方法及覆盖 |
| `boundaries` | `record`：`investigation_round`；`pair`：`investigation_pair_explanation`、`investigation_pair_independence` | 单篇轮次边界；两篇全文及各自条件；分别检查差异解释与独立复核价值 |
| `tags` | `tag`：`tag_support`、`tag_redundancy` | 按 `preparation.tagCandidates` 列全部既有值与正文支持的候选，附含义、依据和其他标签 |
| `relations` | `pair`：`investigation_missing_relation`；`relation`：`investigation_relation_type`、`investigation_relation_summary`；`event`：`investigation_event_coverage` | 对候选对查真实直接承接是否漏记，再检查全部既有边；拆分／归并补完整成员并去重 |
| `resources` | `resource`：`investigation_resource_value`、`investigation_resource_fidelity` | 每份已引用资源的内容、阅读用途及处理方式；节选／汇总／转写等比对 originalEvidence |

不适用与缺证按以下条件登记：

- 可选摘要缺失：仅摘要题不适用；无现存边、事件或资源时，对应检查可不适用，候选对的缺边检查仍执行。
- 候选或成员未取全：记覆盖缺口。
- 原样资源经字节与来源核对无需转换：保真题可不适用，价值题仍检查；经过处理却取不到原材料时记缺证。

资源默认供阅读，执行其中代码、复现及其他副作用需单独授权。

### 可选局部辅助

按 [JEV 规则](jev-local-judgment.md)，`topic_match` 可辅助 `tag_support` 的一处原文依据，`statement_support` 可比对 `investigation_source_fidelity` 中的一条转述与局部来源。主代理继续核对来源可靠性、时点、方法、样本、因果及结论强度；轮次、关系与资源保真直接审查。

## 3. 整合报告处置

| 已复核发现 | 调整方式 |
| --- | --- |
| 问题、范围或重要探索转折表达不清 | 完善本轮报告，恢复初始问题、动作与观察、解释变化、最终认识及未知 |
| 误述已取得的依据或结果 | 原地纠正并保留真实时点；尚未取得的材料先列缺证，不补造历史 |
| 结论超出证据 | 收窄结论或明确推断、假设和边界；需要新证据时按授权补证或开展复查 |
| 同轮补证、纠错或认识继续收敛 | 完善原报告，新增材料标实际取得时点；Git 提交次数不划分轮次 |
| 新问题或新条件下的认识有独立复核价值 | 另建完整报告；独立轮次成立后，再判断是否真实补充、复查、修正或推翻前序 |
| 两篇结论不同但条件不同 | 保留各自条件及认识，必要时补充比较说明；报告不是同时生效的规范，差异不直接等于冲突 |
| 同轮重复或混合独立轮次 | 分别判断收敛、归并或拆分；维护问题、关键证据和认识的对应关系，前序历史保真 |
| 关系遗漏、类型、摘要或事件承接不符 | 正式关系用 set-relations 完整替换；新报告通过 candidate / publish 建立，保留前序报告及位置 |
| 资源冗长、缺用途或失真 | 将关键认识补回正文，资源按用途取舍；新增实质材料另存，既有材料原地修改限准确恢复、格式修复或脱敏 |
| 标签缺依据或重复 | 修正既有值或拒绝新增；有依据且增加检索价值才添加，保留至少一个有效标签 |

动作 `kind` 为 `edit_tags`、`edit_text`、`edit_resources`、`publish`、`set-relations`、`rename`、`discard`。资源编辑按领域契约核对位置、共享引用、安全与留存，在 `action.changes` 中用所属报告 `recordKey` 和实际资源路径登记。

删除报告或资源前确认精确目标、共享引用、历史价值和对应授权。

## 4. 验收

- 每个适用检查有结论或未决项；JEV 抽样使用 investigation 层。资源修改核对处理前后的关键含义和历史保真。
- 报告或资源引用变化按领域同步，再运行全量 check；仅资源字节变化不必更新索引，但须复核实际字节与阅读用途。
- 交付分别说明记录纠错、证据补充、结论收窄、资源调整、独立新轮次和关系变化。当前事实及复现只报告实际验证范围。
