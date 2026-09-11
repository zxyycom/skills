### Case DECISION-STAGE-PENDING-EXISTING-001: Stage 拒绝已有 pending index

Tests:
- `test:51c409919773b2406c203b1d84da1232495a8c9813f74da75ca9813c8cbb996b`

Tags:
- `decision-records`

Contract:
- 已有决策 pending snapshot 时，新的 Stage 不得合并或覆盖。

Proves:
- 首次 stage 后再次执行失败并报告 pending snapshot。
