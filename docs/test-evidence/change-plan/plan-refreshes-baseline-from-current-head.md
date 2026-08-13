### Case CHANGE-PLAN-LIFECYCLE-REFRESH-001: Plan 直接从当前 HEAD 刷新基线
Entry:
- `tools/change-plan/tests/lifecycle.test.ts > plan refreshes the baseline without inspecting the old distance`
- `bun test --test-name-pattern="^plan refreshes the baseline without inspecting the old distance$" ./tools/change-plan/tests/run.ts`

Contract:
- 对现有 Plan 运行 `plan` 时，当前 HEAD 是新 `baseCommit` 的权威来源，刷新路径直接以它覆盖现有基线。

Proves:
- 携带超长基线 sentinel 的现有 Plan 成功完成 `plan -> plan` 重确认。
- 成功结果的 `baseCommit` 等于命令运行时的当前 HEAD。
