### Case DECISION-STAGE-MOVE-001: 按 sourcePath 暂存选择的 ID 移动

Entry:
- `tools/decision-records/tests/stage.test.ts > stage selects one Decision ID when its sourcePath moves between root and archive`
- `bun test --test-name-pattern="^stage selects one Decision ID when its sourcePath moves between root and archive$" ./tools/decision-records/tests/run.ts`

Contract:
- 选择同一 ID 时，root 到 archive 的 sourcePath 变化必须作为该 ID 的移动和派生 index 暂存。

Proves:
- stage 输出包含 root→archive rename 和 decision-index。
