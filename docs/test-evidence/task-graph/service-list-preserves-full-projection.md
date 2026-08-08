### Case TASK-GRAPH-LIST-PROJECTION-001: List projection 保留完整图语义与实际 task ID

Entry:
- `tools/task-graph/tests/graph-projection.test.ts > service list projection preserves complete graph semantics and actual task IDs`
- `bun test --test-name-pattern="^service list projection preserves complete graph semantics and actual task IDs$" ./tools/task-graph/tests/run.ts`

Contract:
- `listTasks()` 返回以实际 task ID 为键的全量 `TaskListItem` 字典；每项在完整图投影上增加 title、direct parent 与 execution phase，不丢失 control、blocker、关系来源、继承路径或反向关系。

Proves:
- 返回 revision 与索引一致，字典键按实际 task ID 排列且每个键等于 item.taskId。
- Fixture 同时包含带 reason 的继承 control、dependency、exclusion、children 与 dependents；每个 list item 逐字段等于同一索引的完整图投影加 title、parentId 与 phase。
