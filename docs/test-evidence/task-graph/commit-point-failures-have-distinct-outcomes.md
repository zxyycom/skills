### Case TASK-GRAPH-COMMIT-001: 旧 revision 返回 WRITE_FAILED，可能已提交或不可读返回 WRITE_OUTCOME_UNKNOWN，并可从索引复核

Entry:
- `tools/task-graph/tests/store.test.ts > commit-point failures distinguish old, committed, unknown, and post-commit outcomes`
- `bun test --test-name-pattern="^commit-point failures distinguish old, committed, unknown, and post-commit outcomes$" ./tools/task-graph/tests/run.ts`

Contract:
- 原子替换是提交点；提交前失败、替换后抛错、无法读回和提交后响应失败具有不同恢复语义，且 store 只能清理本次 `open(wx)` 成功创建的临时路径。

Proves:
- 旧 revision 返回 `WRITE_FAILED`，可能已提交或不可读返回 `WRITE_OUTCOME_UNKNOWN` 并可从索引复核；同名 foreign 临时文件导致 `wx` 失败时内容保持不变且 revision 不前进。
