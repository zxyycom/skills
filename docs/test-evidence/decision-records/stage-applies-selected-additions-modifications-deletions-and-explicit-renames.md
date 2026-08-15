### Case DECISION-STAGE-OVERLAY-001: Stage 应用选择的新增、修改与删除

Entry:
- `tools/decision-records/tests/stage.test.ts > stage applies selected additions modifications deletions and explicit renames`
- `bun test --test-name-pattern="^stage applies selected additions modifications deletions and explicit renames$" ./tools/decision-records/tests/run.ts`

Contract:
- stage 将选择的新增、修改、删除和派生索引作为完整 pending 快照暂存；改名只由显式选择表达。

Proves:
- 修改、删除和新增记录后，断言对应路径及 index 暂存。
