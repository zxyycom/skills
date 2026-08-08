### Case TASK-GRAPH-LIST-ACTIVE-MUTEX-001: Exclusion-running blocker 折叠为 active mutex token

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list renderer maps exclusion-running blockers to active mutex tokens`
- `bun test --test-name-pattern="^task-list renderer maps exclusion-running blockers to active mutex tokens$" ./tools/task-graph/tests/run.ts`

Contract:
- exclusion-running blocker 只派生节点 mutex token；重复 endpoint 去重，并按 task ID 排序。

Proves:
- Running 与 recovery-needed endpoint 输出唯一排序 mutex 列表，摘要只将被阻 task 计数一次。
