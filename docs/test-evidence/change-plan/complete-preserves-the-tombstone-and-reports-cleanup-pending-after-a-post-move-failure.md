### Case CHANGE-PLAN-COMPLETE-003: 清理失败保留可恢复 tombstone
Entry:
- `tools/change-plan/tests/complete.test.ts > complete preserves a recoverable tombstone after cleanup fails`
- `bun test --test-name-pattern="^complete preserves a recoverable tombstone after cleanup fails$" ./tools/change-plan/tests/run.ts`
Contract:
- no-overwrite tombstone 已经完整复制 source 后的精确清理失败不得伪报完成或 rollback；必须报告唯一 recovery child。
Proves:
- 注入 unlink 失败后结果是 `committed-cleanup-pending` 且 `changed: true`。
- source 和报告的 tombstone child 都保留，维护者可从 HEAD 或 tombstone 对账恢复。
