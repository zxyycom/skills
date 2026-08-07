### Case TASK-GRAPH-GC-001: 批量 task removal 在全部门禁通过后一次提交

Entry:
- `tools/task-graph/tests/task-removal.test.ts > bulk task removal is atomic, explicit, and preserves monotonic allocation`
- `bun test --test-name-pattern="^bulk task removal is atomic, explicit, and preserves monotonic allocation$" ./tools/task-graph/tests/run.ts`

Contract:
- 显式非空 task 集合共用结果交付确认，先验证全部选择，再以一次 revision 原子删除，并保持 `nextTaskId` 单调。

Proves:
- 空集合、重复 ID 或未确认结果交付时无变更；合法批次排序返回、只增一次 revision 且不复用 ID。
