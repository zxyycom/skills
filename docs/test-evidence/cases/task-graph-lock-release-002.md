### Case TASK-GRAPH-LOCK-RELEASE-002: lock release 失败时已提交 mutation 返回未知结果

Tests:
- `test:9192b0407f57b610e830d77197801942f2467590a48e2794512fd9f3ad743671`

Tags:
- `task-graph`

Contract:
- mutation 已完成候选提交后，任何 lock release 失败都不能把结果报告为明确未提交或成功。

Proves:
- 原生 unlock 失败时返回带 `phase: lock-release` 和 possible revision 的 `WRITE_OUTCOME_UNKNOWN`，磁盘候选仍保持已提交。
