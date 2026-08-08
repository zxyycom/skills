### Case CHANGE-PLAN-ASSESS-HISTORY-001: 评估拒绝第一父历史之外的基线
Entry:
- `tools/change-plan/tests/assessment.test.ts > assessment rejects a base outside the HEAD first-parent history`
- `bun test --test-name-pattern="^assessment rejects a base outside the HEAD first-parent history$" ./tools/change-plan/tests/run.ts`
Contract:
- Plan 基线必须位于当前 HEAD 的第一父历史上，旁支提交不能作为距离起点。
Proves:
- 即使当前 artifacts 已与旁支基线不同，合并后以旁支提交为基线仍优先返回 `plan-review-required` 与 `base-unavailable`，不会误报为普通 artifact 变化。
