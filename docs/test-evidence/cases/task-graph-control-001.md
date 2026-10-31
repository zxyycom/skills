### Case TASK-GRAPH-CONTROL-001: 本地 queued 成为 control 来源，同时祖先依赖仍产生 blocker

Tests:
- `test:f1b6af2099f15901a3649500bc0494f72290e6d5c7eb0029566678d06515ef60`

Tags:
- `task-graph`

Contract:
- 最近本地 control 覆盖祖先软控制，但不能移除继承的硬依赖。

Proves:
- 本地 queued 成为 control 来源，同时祖先依赖仍产生 blocker。
