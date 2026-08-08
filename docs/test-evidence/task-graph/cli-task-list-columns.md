### Case TASK-GRAPH-CLI-COLUMNS-001: Task-list columns 在 CLI 边界归一化并按优先级选择

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI task-list columns prefer injection then TTY and otherwise fall back to 80`
- `bun test --test-name-pattern="^CLI task-list columns prefer injection then TTY and otherwise fall back to 80$" ./tools/task-graph/tests/run.ts`

Contract:
- CLI 只接受正整数 injected 或 TTY columns；有效 injected 优先于 TTY，无有效值时回退 80。

Proves:
- 80 与 79 分别选择 inline 和 block 文本。
- 有效 TTY=79 被采用，有效 injected=80 覆盖 TTY；零值 injected 继续采用有效 TTY。
- 零值或小数 TTY、non-TTY 无 injection、以及 non-TTY 的零值或小数 injection 都回退 80。
