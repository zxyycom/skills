### Case CHANGE-PLAN-CLI-PLAN-COMMIT-001: Plan CLI 记录已有 HEAD 并接受未提交 artifacts
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI plan records existing HEAD without requiring committed artifacts`
- `bun test --test-name-pattern="^CLI plan records existing HEAD without requiring committed artifacts$" ./tools/change-plan/tests/run.ts`
Contract:
- `plan` 的版本控制基线取命令运行时已有的 HEAD；artifacts 的 Git 状态不参与这项门禁。
Proves:
- 未跟踪的完整 Draft artifacts 能成功进入 plan，写入的 `baseCommit` 等于命令前已有 HEAD，且命令本身不产生新提交。
