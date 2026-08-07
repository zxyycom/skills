### Case TASK-GRAPH-INDEX-CHECK-001: index info 报告规范漂移

Entry:
- `tools/task-graph/tests/store.test.ts > store info reports canonical drift without a separate check operation`
- `bun test --test-name-pattern="^store info reports canonical drift without a separate check operation$" ./tools/task-graph/tests/run.ts`

Contract:
- 结构有效的索引由 `index info` 同时返回 revision、计数、valid、canonical 和 diagnostics，不需要第二个 check 操作。

Proves:
- 非规范但语义合法的索引返回 `valid: true`、`canonical: false` 和 `index-not-canonical`，且查询不重写权威文件。
