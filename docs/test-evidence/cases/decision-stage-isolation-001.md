### Case DECISION-STAGE-ISOLATION-001: Stage 隔离未选择的文件系统变更

Tests:
- `test:4c8b7a9de38ab5c2f59db9d11158f4772fdd090dac824dc5b92e9c28d50d3e48`

Tags:
- `decision-records`

Contract:
- Stage 仅暂存选择的 Decision ID 与派生索引，不携带未选择的 filesystem 变更。

Proves:
- 未选 candidate 不进入暂存区。
