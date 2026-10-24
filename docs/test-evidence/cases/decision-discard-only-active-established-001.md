### Case DECISION-DISCARD-ONLY-ACTIVE-ESTABLISHED-001: Discard 删除唯一 active 已建立决策并保留合法空索引

Tests:
- `test:e5b2b306e151e87840252e57f3177eb564f0093de01a7de475671fb341f55ff5`

Tags:
- `decision-records`

Contract:
- `discard` 可删除无引用的 active 已建立决策；删除末条正式成员后保留合法空派生索引。

Proves:
- 唯一 active 决策 Markdown 被删除；空 index 仍可查询，随后发布新候选可继续维护。
