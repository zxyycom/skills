### Case DECISION-STAGE-BAD-PENDING-001: 索引与全集暂存拒绝坏或删除的pending索引

Tests:
- `test:f92a0c5b0d3e17dd1b574b83ebca9e5083ce099a482bf1717b95c636b50d9612`

Tags:
- `decision-records`

Contract:
- index/all 要严格验证 pending 索引；HEAD 已有索引时 pending 删除须先显式恢复。

Proves:
- 两种 scope 对坏 JSON 和已删 pending 索引都失败，Git pending tree ID 完全不变。
