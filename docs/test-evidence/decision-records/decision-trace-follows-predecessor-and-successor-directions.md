### Case DECISION-TRACE-DIRECTION-001: Trace 遵循前序与后继方向

Entry:
- `tools/decision-records/tests/queries.test.ts > decision trace follows predecessor and successor directions`
- `bun test --test-name-pattern="^decision trace follows predecessor and successor directions$" ./tools/decision-records/tests/run.ts`

Contract:
- trace 按 predecessors/successors 方向遍历稳定 ID 关系。

Proves:
- 断言活动记录前序、归档记录后继及无前序边界。
