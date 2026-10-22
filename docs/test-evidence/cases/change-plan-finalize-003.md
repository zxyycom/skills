### Case CHANGE-PLAN-FINALIZE-003: Finalize 清理失败保留可恢复 tombstone

Tests:
- `test:7942d4e57cfc952f436c7bc79f117dfc58424bba0186997ae7cc53006078a3b3`

Tags:
- `change-plan`

Contract:
- no-overwrite tombstone 已经完整复制 source 后的精确清理失败不得伪报完成或 rollback；必须报告唯一 recovery child。

Proves:
- 注入 unlink 失败后结果是 `committed-cleanup-pending` 且 `changed: true`。
- source 和报告的 tombstone child 均保留完整成员、原始字节与 owner executable bit，headCommit 等于实际 Git HEAD，维护者可从 HEAD 或 tombstone 对账恢复。
