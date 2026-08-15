### Case DECISION-STAGE-TARGET-VALIDATION-001: Stage 拒绝关系目标无效的候选

Entry:
- `tools/decision-records/tests/stage.test.ts > stage rejects invalid candidate relation targets before pending writes`
- `bun test --test-name-pattern="^stage rejects invalid candidate relation targets before pending writes$" ./tools/decision-records/tests/run.ts`

Contract:
- 候选的关系目标无效时 stage 不得写入 pending。

Proves:
- 候选引用不存在的稳定 ID 后失败且暂存区为空。
