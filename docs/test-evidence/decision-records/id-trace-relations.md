### Case DECISION-ID-TRACE-001: 稳定 ID 的 Trace 关系

Entry:
- `tools/decision-records/tests/queries.test.ts > decision trace follows stable ID relations`
- `bun test --test-name-pattern="^decision trace follows stable ID relations$" ./tools/decision-records/tests/run.ts`

Contract:
- trace 按稳定 ID 解析活动与归档记录的关系。

Proves:
- 活动记录的 trace 输出归档关系目标。
