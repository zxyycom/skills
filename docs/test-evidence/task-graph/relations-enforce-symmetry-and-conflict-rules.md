### Case TASK-GRAPH-RELATIONS-001: 写入自动维护对称边并拒绝继承后冲突关系

Entry:
- `tools/task-graph/tests/graph-projection.test.ts > relations enforce symmetric exclusions and reject conflicting inherited pairs`
- `bun test --test-name-pattern="^relations enforce symmetric exclusions and reject conflicting inherited pairs$" ./tools/task-graph/tests/run.ts`

Contract:
- 排斥关系对称，祖先后代排斥及同对依赖/排斥冲突无效。

Proves:
- 写入自动维护对称边并拒绝继承后冲突关系。
