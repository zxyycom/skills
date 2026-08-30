### Case DECISION-REALLOCATION-PREDECESSOR-MINIMUM-001: Evolve 拒绝单前序重划

Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects a one-predecessor reallocation`
- `bun test --test-name-pattern="^evolve rejects a one-predecessor reallocation$" ./tools/decision-records/tests/run.ts`

Contract:
- `重划` 必须承接至少两个不同的直接前序。

Proves:
- 两个后继都只指向同一个前序时，evolve 报告前序数量不足。
