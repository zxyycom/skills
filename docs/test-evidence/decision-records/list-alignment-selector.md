### Case DECISION-LIST-ALIGNMENT-001: List 按 alignment 筛选

Entry:
- `tools/decision-records/tests/queries.test.ts > decision list filters records by alignment selector`
- `bun test --test-name-pattern="^decision list filters records by alignment selector$" ./tools/decision-records/tests/run.ts`

Contract:
- alignment 选择器必须从持久索引返回对应状态。

Proves:
- unaligned 查询仅返回 unaligned 活动记录。
