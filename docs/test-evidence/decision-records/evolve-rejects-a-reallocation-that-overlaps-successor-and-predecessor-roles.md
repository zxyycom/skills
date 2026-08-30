### Case DECISION-REALLOCATION-ROLE-BOUNDARY-001: Evolve 拒绝重划角色重叠

Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects a reallocation that overlaps successor and predecessor roles`
- `bun test --test-name-pattern="^evolve rejects a reallocation that overlaps successor and predecessor roles$" ./tools/decision-records/tests/run.ts`

Contract:
- 单次重划不得把同一个 Decision ID 同时作为所选后继和直接前序，避免把两代关系折叠进一个事件。

Proves:
- 选择一个既有重划后继，同时让新候选指向它时，evolve 在写入前报告角色重叠。
