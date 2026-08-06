### Case TASK-GRAPH-CONTROL-001: 本地 queued 成为 control 来源，同时祖先依赖仍产生 blocker

Entry:
- `tools/task-graph/tests/graph-projection.test.ts > nearest local control overrides ancestor soft control without removing hard constraints`
- `bun test --test-name-pattern="^nearest local control overrides ancestor soft control without removing hard constraints$" ./tools/task-graph/tests/run.ts`

Contract:
- 最近本地 control 覆盖祖先软控制，但不能移除继承的硬依赖。

Proves:
- 本地 queued 成为 control 来源，同时祖先依赖仍产生 blocker。
