### Case DECISION-STAGE-INPUT-001: Stage 拒绝无效、重复和缺失 ID

Entry:
- `tools/decision-records/tests/stage.test.ts > stage rejects invalid duplicate and missing paths without changing pending`
- `bun test --test-name-pattern="^stage rejects invalid duplicate and missing paths without changing pending$" ./tools/decision-records/tests/run.ts`

Contract:
- stage 在暂存前拒绝重复、缺失和越界 ID，不改变已有 pending。

Proves:
- 三类非法输入均失败，已有 README pending 保持不变。
