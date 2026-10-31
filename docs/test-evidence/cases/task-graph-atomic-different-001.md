### Case TASK-GRAPH-ATOMIC-DIFFERENT-001: 任意 atomic reject 都保守报告结果未知

Tests:
- `test:a63525ec6f74c0bc1a8e3346bd24753e6c7e75e29010a1df1c76dcad97c35034`

Tags:
- `task-graph`

Contract:
- Atomic writer 每个候选只调用一次；调用 reject 后不读回、不猜测是否已经替换，也不自动重试。

Proves:
- writer 在替换前抛错、写入完整候选后抛错或留下不同文本后抛错，都只调用一次并返回带 possible revision 的 `WRITE_OUTCOME_UNKNOWN`。
