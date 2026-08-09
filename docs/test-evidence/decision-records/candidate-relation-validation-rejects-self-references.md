### Case DECISION-CANDIDATE-RELATION-SELF-001: 候选关系校验拒绝自引用
Entry:
- `tools/decision-records/tests/relation-validation.test.ts > candidate relation validation rejects self references`
- `bun test --test-name-pattern="^candidate relation validation rejects self references$" ./tools/decision-records/tests/run.ts`
Contract:
- 候选不能以自身决策路径作为关系目标。
Proves:
- 候选修订关系指向自身时，严格检查报告 must not relate to itself。
