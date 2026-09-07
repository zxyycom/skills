### Case TASK-GRAPH-CLAIM-001: 重复领取、排斥任务领取和陈旧 revision 编辑均被拒绝

Tests:
- `test:54027800cf4acbc0702102ff3dbe6954da92f873fe5ae5fda28fab8df757d96c`

Tags:
- `task-graph`

Contract:
- claim 在最新索引上重验 task 状态和有效排斥，普通写操作仍受 revision CAS 约束。

Proves:
- 重复领取、排斥任务领取和陈旧 revision 编辑均被拒绝。
