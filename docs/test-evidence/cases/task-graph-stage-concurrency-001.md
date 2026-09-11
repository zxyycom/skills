### Case TASK-GRAPH-STAGE-CONCURRENCY-001: 并发分段暂存只有一个赢家

Tests:
- `test:fb537ad0fb354f642e1830a28ebea87c29e32123a6cfda4ec6595d19c739c337`

Tags:
- `task-graph`

Contract:
- 同一 task index 的分段 pending 替换在版本管理锁内核对基线与既有 pending，不合并或覆盖另一批 task。

Proves:
- 两个并发选择恰有一个成功，另一个稳定返回可重试 `REVISION_CONFLICT`。
- 最终 pending 恰好包含赢家 task 的候选条目，输家 task 仍保持 HEAD 基线内容。
