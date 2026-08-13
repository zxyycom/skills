### Case CHANGE-PLAN-CLI-PLAN-COMMIT-001: Plan CLI 记录已有 HEAD 并接受未提交 artifacts
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI plan records existing HEAD without requiring committed artifacts`
- `bun test --test-name-pattern="^CLI plan records existing HEAD without requiring committed artifacts$" ./tools/change-plan/tests/run.ts`
Contract:
- `plan` 以命令运行时已有的 HEAD 作为版本控制基线，并允许完整 Draft artifacts 处于未跟踪状态。
Proves:
- 未跟踪的完整 Draft artifacts 成功进入 Plan，写入的 `baseCommit` 等于命令前已有 HEAD，命令前后的 HEAD 保持相同。
