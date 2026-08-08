### Case TASK-GRAPH-LIST-FORM-001: Columns 79 与 80 选择固定 block 和 inline form

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list node form switches at 79 and 80 columns without measuring title width`
- `bun test --test-name-pattern="^task-list node form switches at 79 and 80 columns without measuring title width$" ./tools/task-graph/tests/run.ts`

Contract:
- 关系数量允许时，columns 至少为 80 使用 inline node，否则使用 block node；title 字符和 Unicode cell width 不参与选择。

Proves:
- 同一长中英文与 emoji title 在 80 columns 为 inline，在 79 columns 为带 next 与 title continuation 的 block。
