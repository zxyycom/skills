### Case TASK-GRAPH-BLOCKER-PRIORITY-001: succeeded、failed 与 running 投影的 blockers 为空且没有下一动作

Tests:
- `test:b49382bc99253a8af4ee66d7f12d235badf4105b90a5a7ffda49e494177d7ab8`

Tags:
- `task-graph`

Contract:
- 终态、失败、运行和显式 candidate/waiting/paused 命中后不继续暴露更低优先 blocker。

Proves:
- execution 优先状态不含低级 blocker；显式 control 状态只保留对应 control blocker。
