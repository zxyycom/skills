### Case TASK-GRAPH-LIST-RENDER-PROTOCOL-001: 空 task list 使用固定零值摘要

Tests:
- `test:488badddc9a4f9984cbee7b667e41fee60697be124eb61173ac80206d5b53ffe`

Tags:
- `task-graph`

Contract:
- 空的成功 list 结果只渲染固定六项零值摘要，并以一个 LF 结束。

Proves:
- 输出逐字节等于零 tasks、tracks、actionable、running、recovery-needed 与 mutex-blocked 的单行摘要。
