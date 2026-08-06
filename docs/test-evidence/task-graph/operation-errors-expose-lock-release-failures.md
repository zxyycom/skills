### Case TASK-GRAPH-LOCK-RELEASE-001: release 失败不被原 REQUEST_INVALID 遮蔽，LOCK_RECOVERY_REQUIRED details 可定位原错误

Entry:
- `tools/task-graph/tests/store.test.ts > operation errors expose lock-release failures with the original error context`
- `bun test --test-name-pattern="^operation errors expose lock-release failures with the original error context$" ./tools/task-graph/tests/run.ts`

Contract:
- operation 失败后的 lock release/isolation 失败必须提升为可恢复锁错误并保留原错误上下文。

Proves:
- release 失败不被原 REQUEST_INVALID 遮蔽，LOCK_RECOVERY_REQUIRED details 可定位原错误。
