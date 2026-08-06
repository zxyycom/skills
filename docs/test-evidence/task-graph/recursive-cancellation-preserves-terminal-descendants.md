### Case TASK-GRAPH-CANCEL-001: 取消集合确定且已成功子任务保留

Entry:
- `tools/task-graph/tests/lifecycle.test.ts > recursive cancellation preserves terminal descendants and rejects leased descendants atomically`
- `bun test --test-name-pattern="^recursive cancellation preserves terminal descendants and rejects leased descendants atomically$" ./tools/task-graph/tests/run.ts`

Contract:
- 父任务取消递归处理非终态后代，保留已有终态，并在后代持有租约时整笔拒绝。

Proves:
- 取消集合确定且已成功子任务保留；租约冲突不会产生部分变更。
