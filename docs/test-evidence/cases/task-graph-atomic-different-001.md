### Case TASK-GRAPH-ATOMIC-DIFFERENT-001: 任意 atomic reject 都保守报告结果未知

Tests:
- `test:a35b9e802afe366eb01716bf30011879885b6a5d8b7ee5d79a3b2de6f664a90a`

Tags:
- `task-graph`

Contract:
- Atomic writer 每个候选只调用一次；调用 reject 后不读回、不猜测是否已经替换，也不自动重试。

Proves:
- writer 在替换前抛错、写入完整候选后抛错或留下不同文本后抛错，都只调用一次并返回带 possible revision 的 `WRITE_OUTCOME_UNKNOWN`。
