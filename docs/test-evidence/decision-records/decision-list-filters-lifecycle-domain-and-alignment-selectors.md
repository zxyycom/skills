### Case DECISION-LIST-FILTERS-001: 决策列表按生命周期、标签与对齐状态筛选

Entry:
- `tools/decision-records/tests/queries.test.ts > decision list filters lifecycle and tag selectors`
- `bun test --test-name-pattern="^decision list filters lifecycle and tag selectors$" ./tools/decision-records/tests/run.ts`

Contract:
- List 从持久索引按生命周期、AND 标签和对齐状态选择记录；使用标签选择器。

Proves:
- 活动 project-tooling 与归档 decision-records 查询各只返回匹配 ID。
