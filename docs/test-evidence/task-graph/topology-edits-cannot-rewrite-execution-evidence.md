### Case TASK-GRAPH-PROTECTION-001: 影响受保护任务依赖或 children 的编辑以 STATE_CONFLICT 拒绝

Entry:
- `tools/task-graph/tests/graph-projection.test.ts > topology edits cannot rewrite running or terminal execution evidence`
- `bun test --test-name-pattern="^topology edits cannot rewrite running or terminal execution evidence$" ./tools/task-graph/tests/run.ts`

Contract:
- 运行中、成功和取消任务的有效祖先、依赖、排斥与 children 证据不可被普通关系编辑或带 parentId 的 task 创建改写。

Proves:
- 直接关系编辑以及在受保护 task 的排斥目标下新建 child、从而扩张有效排斥集合的创建操作，都以 `STATE_CONFLICT` 拒绝且不改变原索引或编号。
