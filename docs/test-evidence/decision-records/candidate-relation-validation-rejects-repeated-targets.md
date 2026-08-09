### Case DECISION-CANDIDATE-RELATION-REPEATED-TARGET-001: 候选关系校验拒绝重复目标
Entry:
- `tools/decision-records/tests/relation-validation.test.ts > candidate relation validation rejects repeated targets`
- `bun test --test-name-pattern="^candidate relation validation rejects repeated targets$" ./tools/decision-records/tests/run.ts`
Contract:
- 同一候选的直接关系集合中，每个目标只能出现一次，即使关系类型不同也不能重复。
Proves:
- 同一目标同时以修订和替代关系出现时，严格检查报告 repeats relationship target。
