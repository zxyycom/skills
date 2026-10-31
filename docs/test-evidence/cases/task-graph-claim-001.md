### Case TASK-GRAPH-CLAIM-001: 重复领取、排斥任务领取和陈旧 revision 编辑均被拒绝

Tests:
- `test:2ae36ba15e774ed3244686ab925f15a4c805d7168c577c735e69d4812b67d8b4`

Tags:
- `task-graph`

Contract:
- claim 在最新索引上重验 task 状态和有效排斥，普通写操作仍受 revision CAS 约束。

Proves:
- 重复领取、排斥任务领取和陈旧 revision 编辑均被拒绝。
