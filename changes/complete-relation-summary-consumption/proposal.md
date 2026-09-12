# Proposal

让 Decision 与 Investigation 在关系筛选、关系写入核对和 trace 中提供可定位到具体边的摘要，并为其他入口保留清楚的读取边界。

## Why

关系摘要已进入 Markdown、索引和部分查询输出。入口审计发现三个消费缺口：关系筛选缺少命中边依据；完整关系替换的结果难以核对摘要移除；Decision trace 事件的匿名摘要缺少对端指向。普通发现、候选准备和状态回执则适合保持记录视图。依据见[审计附件](relation-summary-audit.md)。

## Outcome

Agent 能从相关入口取得本次判断所需的边说明，区分摘要缺省、输出省略与尚未读取，并按明确的 source 继续阅读全文。每类入口都有展示决定和对应验证；历史摘要覆盖率作为数据基线，交付目标是消费可用性。

## Scope

### Intended Change

- **关系筛选**：list/search 返回同快照的匹配边，CLI 有界展示；普通发现和文本命中证据保持原语义。
- **写入核对**：Decision 新候选 activate/evolve、Investigation publish/set-relations 返回完整关系核对结果；set-relations 增加只读预检。
- **trace 表达**：明确边归属和缺省标记，调整 Decision 事件摘要承接位置，保持既有图选择与 JSON。
- **其他入口**：完整读取、候选准备、状态/身份回执、检查和索引维护继续按各自职责消费摘要。精确行为见 [P1–P6](design.md#intended-change)。

### Resulting Impacts

两个领域分别同步查询/事务类型、CLI、skill 读取指引、固定契约及测试；公开声明与生成制品沿用现有分发边界。长期消费取舍由 Decision Records 承接。

## Success Criteria

1. 两域全部命令及生命周期分支均有展示决定、依据和验证入口，详见审计矩阵及 tasks。
2. 关系筛选结果能正确定位 source/type/target，完整返回匹配边；CLI 预览、分页与完整读取符合 P1/P2，原文本证据保持不变。
3. 写入核对覆盖建立、替换、清空、仅摘要变化和无变化；预检零写入，正式结果与事务 outcome 一致。
4. trace 普通边及复杂事件的摘要归属明确；缺省、相同摘要、转义与截断场景通过验证，JSON 和图选择保持不变。
5. 摘要可选、40 码点、索引透传及 rename 保留得到回归验证；实际受影响的文档、Case、分发制品和版本同步，相关检查通过。

## Affected Owners

| Owner | 责任 |
| --- | --- |
| [Decision Records](../../skills/decision-records/SKILL.md)、[Investigation Report](../../skills/investigation-report/SKILL.md) | 各领域写作、读取和固定契约 |
| [Decision 工具](../../tools/decision-records/)、[Investigation 工具](../../tools/investigation-report/) | 查询、事务、renderer、类型和测试 |
| [项目工具链](../../docs/tooling.md)、[编码规范](../../docs/coding-style.md) | 源码/生成物边界、构建、验证和版本 |
| [测试证据](../../skills/test-evidence-review/SKILL.md)、[决策记录](../../skills/decision-records/SKILL.md) | 测试 Case 与长期消费取舍 |
