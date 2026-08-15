### Case DECISION-STAGE-LEGACY-001: Stage 拒绝旧领域基线

Entry:
- `tools/decision-records/tests/stage.test.ts > stage rejects an old domain revision before changing pending files`
- `bun test --test-name-pattern="^stage rejects an old domain revision before changing pending files$" ./tools/decision-records/tests/run.ts`

Contract:
- 当前 Stage 不能把旧领域目录 revision 与当前 ID/布局来源混合为 pending snapshot。

Proves:
- 旧领域基线下 stage 失败且暂存区为空。
