### Case TASK-GRAPH-CANCEL-001: 取消集合确定且已成功子任务保留

Tests:
- `test:80f751188290fe3c77b2bf0f1e5990f95547442d82e155377db48aa6b329e08c`

Tags:
- `task-graph`

Contract:
- 父任务取消递归处理非终态后代，保留已有终态，并在后代持有租约时整笔拒绝。

Proves:
- 取消集合确定且已成功子任务保留；租约冲突不会产生部分变更。
