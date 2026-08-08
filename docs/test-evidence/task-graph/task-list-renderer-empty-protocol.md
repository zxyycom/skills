### Case TASK-GRAPH-LIST-RENDER-PROTOCOL-001: 空 task list 使用固定零值摘要

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list renderer emits the exact empty success protocol`
- `bun test --test-name-pattern="^task-list renderer emits the exact empty success protocol$" ./tools/task-graph/tests/run.ts`

Contract:
- 空的成功 list 结果只渲染固定六项零值摘要，并以一个 LF 结束。

Proves:
- 输出逐字节等于零 tasks、tracks、actionable、running、recovery-needed 与 mutex-blocked 的单行摘要。
