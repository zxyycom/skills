### Case DECISION-STAGE-PENDING-EXISTING-001: Stage 拒绝已有 pending index

Tests:
- `test:78a7c123769b54bbeeb3465886217bd1c3b2569aab0542e312bf4c4a21c4c7da`

Tags:
- `decision-records`

Contract:
- 已有决策 pending snapshot 时，新的 Stage 不得合并或覆盖。

Proves:
- 首次 stage 后再次执行失败并报告 pending snapshot。
