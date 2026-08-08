### Case TASK-GRAPH-LIST-FOLDING-OMIT-001: 可从全量数据恢复的 blocker 不重复显示

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list renderer omits blockers recoverable from full task data`
- `bun test --test-name-pattern="^task-list renderer omits blockers recoverable from full task data$" ./tools/task-graph/tests/run.ts`

Contract:
- Control、dependency-incomplete 与 child-incomplete 已能从全量节点和关系恢复，不进入 blocked-by 或 mutex token。

Proves:
- control-candidate、control-waiting、control-paused、dependency-incomplete 与 child-incomplete 同时存在时节点仍没有 blocker token。
