### Case TASK-GRAPH-STAGE-CONCURRENCY-001: 并发分段暂存只有一个赢家

Tests:
- `test:fd32d44e70773dc711e38a7f99dab5d965d28d7b2bd8816fb45fb57a05f5fe89`

Tags:
- `task-graph`

Contract:
- 同一 task index 的分段 pending 替换在版本管理锁内核对基线与既有 pending，不合并或覆盖另一批 task。

Proves:
- 两个并发选择恰有一个成功，另一个稳定返回可重试 `REVISION_CONFLICT`。
- 最终 pending 恰好包含赢家 task 的候选条目，输家 task 仍保持 HEAD 基线内容。
