### Case TASK-GRAPH-CLI-COLUMNS-001: Task-list columns 在 CLI 边界归一化并按优先级选择

Tests:
- `test:bec9b6bb5c8f2016450f8b8ccf2332d76a668e7dbc2a25aab27e11ea1239e70e`

Tags:
- `task-graph`

Contract:
- CLI 只接受正整数 injected 或 TTY columns；有效 injected 优先于 TTY，无有效值时回退 80。

Proves:
- 80 与 79 分别选择 inline 和 block 文本。
- 有效 TTY=79 被采用，有效 injected=80 覆盖 TTY；零值 injected 继续采用有效 TTY。
- 零值或小数 TTY、non-TTY 无 injection、以及 non-TTY 的零值或小数 injection 都回退 80。
