### Case DECISION-SPLIT-SINGLE-SUCCESSOR-001: Evolve 拒绝单后继拆分
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects one selected split successor`
- `bun test --test-name-pattern="^evolve rejects one selected split successor$" ./tools/decision-records/tests/run.ts`
Contract:
- `拆分` 是至少包含两个显式后继的闭合一对多策略，单后继不能通过来源关系重新挂接粗前序。
Proves:
- 只选择一个带拆分来源关系的候选时，evolve 报告至少需要两个显式 successor。
