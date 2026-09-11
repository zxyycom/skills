### Case TASK-GRAPH-CLAIM-001: 重复领取、排斥任务领取和陈旧 revision 编辑均被拒绝

Tests:
- `test:73a8cee6e9d462a3d0ba4624db7b24d1b48de8d0d5bf5391ea5fd94c537822d3`

Tags:
- `task-graph`

Contract:
- claim 在最新索引上重验 task 状态和有效排斥，普通写操作仍受 revision CAS 约束。

Proves:
- 重复领取、排斥任务领取和陈旧 revision 编辑均被拒绝。
