### Case TASK-GRAPH-CANCEL-001: 取消集合确定且已成功子任务保留

Tests:
- `test:ca50d1f0140048378f02ae629791309c1dc0e14cb9cb3f9b1b9bb503772e5085`

Tags:
- `task-graph`

Contract:
- 父任务取消递归处理非终态后代，保留已有终态，并在后代持有租约时整笔拒绝。

Proves:
- 取消集合确定且已成功子任务保留；租约冲突不会产生部分变更。
