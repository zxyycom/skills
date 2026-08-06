### Case TASK-GRAPH-CLAIM-001: 重复领取、排斥任务领取和陈旧 revision 编辑均被拒绝

Entry:
- `tools/task-graph/tests/lifecycle.test.ts > claim revalidates same-task and exclusion conflicts against the latest index`
- `bun test --test-name-pattern="^claim revalidates same-task and exclusion conflicts against the latest index$" ./tools/task-graph/tests/run.ts`

Contract:
- claim 在最新索引上重验 task 状态和有效排斥，普通写操作仍受 revision CAS 约束。

Proves:
- 重复领取、排斥任务领取和陈旧 revision 编辑均被拒绝。
