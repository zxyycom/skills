### Case DECISION-CANDIDATE-DISCARD-UNRECORDED-001: Discard 删除未被已记录集合包含的候选

Tests:
- `test:1eb0c63a2d81463fcf3c7560802e0d8b039410893979b50e79b5a039411a71ba`

Tags:
- `decision-records`

Contract:
- 完整且未被引用的 candidate 不在给定已记录集合中时，普通 discard 允许删除，无需已记录候选删除确认。

Proves:
- 显式已记录集合包含其他 ID 但不含候选时，领域准备产生该候选的精确删除计划，含原字节与 nextText=null。
- 非 Git FS fixture 的实际 CLI discard 删除候选，已建立成员的正式索引完整字节不变。
