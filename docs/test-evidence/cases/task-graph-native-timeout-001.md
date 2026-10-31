### Case TASK-GRAPH-NATIVE-TIMEOUT-001: 活跃 native holder 超时且稳定锁文件保留

Tests:
- `test:2793b45e9cafa88341b53ad48c686d6ef2147a32259b77f42c0cbba8d8947e7e`

Tags:
- `task-graph`

Contract:
- tryLock 竞争只按默认 5 秒单调期限轮询，达到期限返回 `LOCK_TIMEOUT`，不得偷锁或 unlink 稳定文件。

Proves:
- 活跃 holder 下可控单调时钟精确推进到 5000 ms，details 含默认 waitMilliseconds，锁文件仍为普通文件。
