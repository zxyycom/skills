### Case DECISION-DISCARD-ONLY-ARCHIVED-ESTABLISHED-001: Discard 删除唯一 archived 已建立决策并保留合法空索引

Tests:
- `test:39cdcca75fe5248ded579b6498a09a1de088b7ca92dc92af0e4f6e8136a2dcf8`

Tags:
- `decision-records`

Contract:
- `discard` 同样可删除无引用的 archived 已建立决策；删除末条正式成员后保留合法空派生索引。

Proves:
- archive 下 Markdown 被删除；空 index 仍可查询，随后发布新候选可继续维护。
