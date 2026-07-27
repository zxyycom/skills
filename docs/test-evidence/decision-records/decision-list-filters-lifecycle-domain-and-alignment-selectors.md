### Case DECISION-LIST-FILTERS-001: 决策列表按生命周期、领域与对齐状态筛选
Entry:
- `tools/decision-records/tests/queries.test.ts > decision list filters lifecycle, domain, and alignment selectors`
- `bun test --test-name-pattern="^decision list filters lifecycle, domain, and alignment selectors$" ./tools/decision-records/tests/run.ts`
Contract:
- List CLI 必须按生命周期、领域与对齐状态返回对应决策，并验证领域选择器。
Proves:
- active、archived、all、full-time、domain 和 alignment 选择器产生匹配集合与格式。
- 空领域返回合法空集合，重复或未知领域选择器产生参数诊断。
