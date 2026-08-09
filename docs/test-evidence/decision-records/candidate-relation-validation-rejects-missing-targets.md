### Case DECISION-CANDIDATE-RELATION-MISSING-001: 候选关系校验拒绝缺失目标
Entry:
- `tools/decision-records/tests/relation-validation.test.ts > candidate relation validation rejects missing targets`
- `bun test --test-name-pattern="^candidate relation validation rejects missing targets$" ./tools/decision-records/tests/run.ts`
Contract:
- 候选关系的目标必须存在于可扫描的决策集合中。
Proves:
- 候选修订关系指向不存在的 Markdown 路径时，严格检查报告 target does not exist。
