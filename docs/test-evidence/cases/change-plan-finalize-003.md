### Case CHANGE-PLAN-FINALIZE-003: Finalize 清理失败保留可恢复 tombstone

Tests:
- `test:d771d34a7d142f95a085be966218702df7508d90ff67bd197a490a26ee61904f`

Tags:
- `change-plan`

Contract:
- no-overwrite tombstone 已经完整复制 source 后的精确清理失败不得伪报完成或 rollback；必须报告唯一 recovery child。

Proves:
- 注入 unlink 失败后结果是 `committed-cleanup-pending` 且 `changed: true`。
- source 和报告的 tombstone child 均保留完整成员、原始字节与 owner executable bit，headCommit 等于实际 Git HEAD，维护者可从 HEAD 或 tombstone 对账恢复。
