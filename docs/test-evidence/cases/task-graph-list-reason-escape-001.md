### Case TASK-GRAPH-LIST-REASON-ESCAPE-001: Control reason 使用 JSON string escaping

Tests:
- `test:7ac6194e2daa2f55bac1adf5b92e5b2dd709d74177e5f4a474491a6b00576d4b`

Tags:
- `task-graph`

Contract:
- Node 的 control reason 使用 JSON string serialization，不能让换行或引号破坏文本协议结构。

Proves:
- 完整 inline node 逐字节包含转义后的换行、双引号与反斜杠，title 保持在 reason token 之后。
- 完整输出仍只有摘要、空行、track 与一个 node 四个物理行，reason 没有增加 continuation line。
