### Case TASK-GRAPH-LIST-REASON-ESCAPE-001: Control reason 使用 JSON string escaping

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list renderer JSON-escapes control reasons`
- `bun test --test-name-pattern="^task-list renderer JSON-escapes control reasons$" ./tools/task-graph/tests/run.ts`

Contract:
- Node 的 control reason 使用 JSON string serialization，不能让换行或引号破坏文本协议结构。

Proves:
- 完整 inline node 逐字节包含转义后的换行、双引号与反斜杠，title 保持在 reason token 之后。
- 完整输出仍只有摘要、空行、track 与一个 node 四个物理行，reason 没有增加 continuation line。
