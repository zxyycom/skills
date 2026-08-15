### Case DECISION-STAGE-ADDITION-001: 单选新 ID 表达 addition 而非改名

Entry:
- `tools/decision-records/tests/stage.test.ts > stage treats a selected new ID as an addition and preserves an unselected old ID`
- `bun test --test-name-pattern="^stage treats a selected new ID as an addition and preserves an unselected old ID$" ./tools/decision-records/tests/run.ts`

Contract:
- 单选 new ID 只能表达 addition，工具不从磁盘差异推断 rename。

Proves:
- pending index 同时保留未选择的 old ID 与新增 ID。
