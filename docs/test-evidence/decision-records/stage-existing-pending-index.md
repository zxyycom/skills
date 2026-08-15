### Case DECISION-STAGE-PENDING-EXISTING-001: Stage 拒绝已有 pending index

Entry:
- `tools/decision-records/tests/stage.test.ts > stage rejects an existing pending decision index`
- `bun test --test-name-pattern="^stage rejects an existing pending decision index$" ./tools/decision-records/tests/run.ts`

Contract:
- 已有决策 pending snapshot 时，新的 Stage 不得合并或覆盖。

Proves:
- 首次 stage 后再次执行失败并报告 pending snapshot。
