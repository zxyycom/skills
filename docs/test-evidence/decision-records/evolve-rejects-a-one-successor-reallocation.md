### Case DECISION-REALLOCATION-SUCCESSOR-MINIMUM-001: Evolve 拒绝单后继重划

Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects a one-successor reallocation`
- `bun test --test-name-pattern="^evolve rejects a one-successor reallocation$" ./tools/decision-records/tests/run.ts`

Contract:
- `重划` 是闭合的多前序多后继策略，不能以一个后继建立。

Proves:
- 只选择一个具有两个重划前序的候选时，evolve 报告至少需要两个显式 successor。
