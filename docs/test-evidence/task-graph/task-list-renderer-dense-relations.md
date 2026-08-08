### Case TASK-GRAPH-LIST-DENSE-RELATIONS-001: 任一关系列表超过三个 endpoint 时 node 使用 block form

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list node form switches when any relation list exceeds three endpoints`
- `bun test --test-name-pattern="^task-list node form switches when any relation list exceeds three endpoints$" ./tools/task-graph/tests/run.ts`

Contract:
- Columns 为 80 时，去重后的 needs、blocked-by 或 active mutex 任一列表超过三个 item，都独立触发 node block form。

Proves:
- Needs、blocked-by 和 mutex 三个矩阵场景都把四个排序后的 item 放入对应 continuation，且不产生其他关系 token。
- Mutex 场景同时保留 running、recovery-needed 和 mutex-blocked 摘要计数。
