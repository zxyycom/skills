### Case TASK-GRAPH-CANCEL-001: 取消集合确定且已成功子任务保留

Tests:
- `test:e55d9dbd8ef60b8bf30f19f29743896c82821795579c9683409aac3488adb38b`

Tags:
- `task-graph`

Contract:
- 父任务取消递归处理非终态后代，保留已有终态，并在后代持有租约时整笔拒绝。

Proves:
- 取消集合确定且已成功子任务保留；租约冲突不会产生部分变更。
