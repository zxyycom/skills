### Case DECISION-DISCARD-ONLY-ACTIVE-ESTABLISHED-001: Discard 删除唯一 active 已建立决策并移除派生索引

Tests:
- `test:fdbec552fc83412bc3bf6c0754ff0b55b57c6e0bca0998b77d8daf967370c3ec`

Tags:
- `decision-records`

Contract:
- `discard` 可删除无引用的 active 已建立决策；删除后没有任何已建立决策时，不保留空派生索引。

Proves:
- 唯一 active 决策的 Markdown 与 `decision-index.json` 都被移除。
