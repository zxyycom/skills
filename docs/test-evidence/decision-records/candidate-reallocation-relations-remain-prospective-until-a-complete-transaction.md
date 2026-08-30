### Case DECISION-REALLOCATION-CANDIDATE-001: 候选重划关系保持前瞻性

Entry:
- `tools/decision-records/tests/relation-validation.test.ts > candidate reallocation relations remain prospective until a complete transaction`
- `bun test --test-name-pattern="^candidate reallocation relations remain prospective until a complete transaction$" ./tools/decision-records/tests/run.ts`

Contract:
- 单个候选可预先声明重划关系，但完整多对多形状只在建立或修订事务及已建立图中校验。

Proves:
- 只有一条重划关系的候选通过前瞻检查并仍以 candidate 计数。
