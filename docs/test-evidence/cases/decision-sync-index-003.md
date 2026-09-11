### Case DECISION-SYNC-INDEX-003: 决策事务在同步索引持锁时快速失败

Tests:
- `test:f3c040fc3de70123c81084aff94a4431684cceb587d8d32eed18ecdd13ff99c6`

Tags:
- `decision-records`

Contract:
- 所有会共同写入 Decision Markdown 与派生索引的领域事务，必须与 `sync-index` 争用同一个集合级 mutation lock。
- `sync-index` 仍在写入时，新的领域事务快速失败、零写入，并要求在同步结束后重试。

Proves:
- 真实 `sync-index` 在原子替换索引前持锁时，`applyDecisionChanges` 报告锁冲突与重试动作，未改写 Markdown 或索引。
- 解除同步写入后索引完成发布，并通过严格 Decision 验证。
