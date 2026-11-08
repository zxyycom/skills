### Case DECISION-STAGE-BAD-PENDING-001: 索引暂存拒绝已删除的 pending 索引

Tests:
- `test:a922ab01cf4dbcc8346297d66392fa2dd18a8caf226b9994394f524b9ff42f77`

Tags:
- `decision-records`

Contract:
- 已有 HEAD 索引时 index scope 不将 pending 删除误当成空索引。

Proves:
- pending 索引已删除时操作失败，完整 pending 条目及工作区索引字节不变。
