### Case DECISION-REALLOCATION-PURITY-001: Evolve 拒绝混合重划关系

Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects mixed reallocation and other successor relations`
- `bun test --test-name-pattern="^evolve rejects mixed reallocation and other successor relations$" ./tools/decision-records/tests/run.ts`

Contract:
- 重划事务的每个后继都必须有重划关系，且不得混用其他关系类型。

Proves:
- 一个后继同时保存重划与修订关系时，evolve 在写入前拒绝该选择。
