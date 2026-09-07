### Case TASK-GRAPH-CONTROL-001: 本地 queued 成为 control 来源，同时祖先依赖仍产生 blocker

Tests:
- `test:05ca83c24c792f63e85ade54cc8db2fcf8e76c1c95b4453dd2208fdef14bb0e7`

Tags:
- `task-graph`

Contract:
- 最近本地 control 覆盖祖先软控制，但不能移除继承的硬依赖。

Proves:
- 本地 queued 成为 control 来源，同时祖先依赖仍产生 blocker。
