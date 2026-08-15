### Case DECISION-STAGE-BOOTSTRAP-MISSING-001: 无 revision 的 Stage 拒绝不存在 ID

Entry:
- `tools/decision-records/tests/stage.test.ts > stage rejects a missing ID when bootstrapping without a revision`
- `bun test --test-name-pattern="^stage rejects a missing ID when bootstrapping without a revision$" ./tools/decision-records/tests/run.ts`

Contract:
- 没有 revision/baseline 的 bootstrap 不能把不存在的选择 ID 解释为空集合或写入 pending。

Proves:
- 空决策目录中的不存在 ID 失败，暂存区保持为空。
