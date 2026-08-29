### Case DECISION-EVOLVE-DISCARD-REFERENCE-001: Evolve discard 拒绝仍被引用的决策
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve discard rejects a predecessor referenced by another candidate`
- `bun test --test-name-pattern="^evolve discard rejects a predecessor referenced by another candidate$" ./tools/decision-records/tests/run.ts`
Contract:
- 被剩余 candidate 或已建立记录引用的删除目标不能被 discard。
Proves:
- CLI 报告引用 ID，且不会修改后继、引用记录、目标或索引。
