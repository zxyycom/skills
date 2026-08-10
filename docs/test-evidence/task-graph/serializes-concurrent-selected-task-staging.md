### Case TASK-GRAPH-STAGE-CONCURRENCY-001: 并发分段暂存只有一个赢家

Entry:
- `tools/task-graph/tests/staging.test.ts > serializes concurrent selected-task staging without overwriting the winning batch`
- `bun test --test-name-pattern="^serializes concurrent selected-task staging without overwriting the winning batch$" ./tools/task-graph/tests/run.ts`

Contract:
- 同一 task index 的分段 pending 替换在版本管理锁内核对基线与既有 pending，不合并或覆盖另一批 task。

Proves:
- 两个并发选择恰有一个成功，另一个稳定返回可重试 `REVISION_CONFLICT`。
- 最终 pending 恰好包含赢家 task 的候选条目，输家 task 仍保持 HEAD 基线内容。
