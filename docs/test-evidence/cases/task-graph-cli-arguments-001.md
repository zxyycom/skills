### Case TASK-GRAPH-CLI-ARGUMENTS-001: 歧义执行前置条件、缺失 reason 和多余 reason 均以 ARGUMENT_INVALID 拒绝

Tests:
- `test:55aae04ffc897a0d14df120c7b939338d8666c0075e276febacf75cdf4c66664`

Tags:
- `task-graph`

Contract:
- complete/cancel 必须且只能提供 lease 或 expectedRevision 之一；claim 恢复三元组必须完整；control 与 reason 必须组成合法组合。

Proves:
- 执行前置条件同给或都不给、不完整 claim 恢复三元组、缺失 control reason 和多余 reason 均以 `ARGUMENT_INVALID` 拒绝。
