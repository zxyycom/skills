### Case CHANGE-PLAN-ASSESS-HISTORY-001: 评估拒绝第一父历史之外的基线
Entry:
- `tools/change-plan/tests/assessment.test.ts > assessment rejects a base outside the HEAD first-parent history`
- `bun test --test-name-pattern="^assessment rejects a base outside the HEAD first-parent history$" ./tools/change-plan/tests/run.ts`
Contract:
- Plan 基线必须位于当前 HEAD 的第一父历史上，旁支提交不能作为距离起点。
Proves:
- 合并后以旁支提交为基线返回 `plan-review-required` 与 `base-unavailable`，不会生成无法成立的 Git 距离证据。
