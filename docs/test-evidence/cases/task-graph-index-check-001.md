### Case TASK-GRAPH-INDEX-CHECK-001: index info 报告规范漂移

Tests:
- `test:6c35fdd8b5a07312950759bd394ccb62d874e52602fd5fee8ee3df996978e42b`

Tags:
- `task-graph`

Contract:
- 结构有效的索引由 `index info` 同时返回 revision、计数、valid、canonical 和 diagnostics，不需要第二个 check 操作。

Proves:
- 非规范但语义合法的索引返回 `valid: true`、`canonical: false` 和 `index-not-canonical`，且查询不重写权威文件。
