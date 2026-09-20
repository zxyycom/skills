### Case CHANGE-PLAN-FINALIZE-003: Finalize 清理失败保留可恢复 tombstone

Tests:
- `test:7f9044f924b6d30d2e12fc12f3b84fc85b6033b709f3c3e6e3a5d9c922dea935`

Tags:
- `change-plan`

Contract:
- no-overwrite tombstone 已经完整复制 source 后的精确清理失败不得伪报完成或 rollback；必须报告唯一 recovery child。

Proves:
- 注入 unlink 失败后结果是 `committed-cleanup-pending` 且 `changed: true`。
- source 和报告的 tombstone child 都保留，维护者可从 HEAD 或 tombstone 对账恢复。
