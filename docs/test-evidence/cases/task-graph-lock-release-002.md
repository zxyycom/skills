### Case TASK-GRAPH-LOCK-RELEASE-002: lock release 失败时已提交 mutation 返回未知结果

Tests:
- `test:b3b97c86b3283843522ac28d0e725c66da624e5988d32ee78a72192d54b986e7`

Tags:
- `task-graph`

Contract:
- mutation 已完成候选提交后，任何 lock release 失败都不能把结果报告为明确未提交或成功。

Proves:
- 原生 unlock 失败时返回带 `phase: lock-release` 和 possible revision 的 `WRITE_OUTCOME_UNKNOWN`，磁盘候选仍保持已提交。
