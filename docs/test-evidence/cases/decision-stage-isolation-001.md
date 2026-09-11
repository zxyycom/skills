### Case DECISION-STAGE-ISOLATION-001: Stage 隔离未选择的文件系统变更

Tests:
- `test:2d8b82b436ab90d41f1ca4f64885566bad3bbf7de619177048f15239d9f87c51`

Tags:
- `decision-records`

Contract:
- Stage 仅暂存选择的 Decision ID 与派生索引，不携带未选择的 filesystem 变更。

Proves:
- 未选 candidate 不进入暂存区。
