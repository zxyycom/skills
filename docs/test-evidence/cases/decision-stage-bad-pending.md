### Case DECISION-STAGE-BAD-PENDING-001: 索引与全集暂存拒绝坏或删除的pending索引

Tests:
- `test:fc26bcde334c9e6892a7296fde3751f8f8ff296ac4a9c5234cc829dcf05119ac`

Tags:
- `decision-records`

Contract:
- index/all 要严格验证 pending 索引；HEAD 已有索引时 pending 删除须先显式恢复。

Proves:
- 两种 scope 对坏 JSON 和已删 pending 索引都失败，Git pending tree ID 完全不变。
