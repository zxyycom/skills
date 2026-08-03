### Case DECISION-DOMAIN-CATALOG-001: 决策域目录验证 owner 与成员关系
Entry:
- `tools/decision-records/tests/decision-domain-catalog.test.ts > decision domain catalog validates ownership and domain membership`
- `bun test --test-name-pattern="^decision domain catalog validates ownership and domain membership$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策域目录必须唯一声明 owner，并只接纳属于该域的决策。
Proves:
- 常规 list 不遍历来源并继续返回索引快照；严格验证对缺失已使用领域、记录内冗余 domain 字段、未知候选领域和非空约束违反产生定位诊断。
