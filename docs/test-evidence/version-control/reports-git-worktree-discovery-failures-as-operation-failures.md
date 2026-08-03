### Case VERSION-CONTROL-DISCOVERY-FAILURE-001: Git 工作树发现故障报告为操作失败
Entry:
- `tools/shared/tests/version-control.test.ts > reports Git worktree discovery failures as operation failures`
- `bun test --test-name-pattern="^reports Git worktree discovery failures as operation failures$" ./tools/shared/tests/version-control.test.ts`
Contract:
- 只有确认起点不在 Git 工作树内时才能返回 `not-repository`；损坏或受限的仓库发现必须保持为操作失败。
Proves:
- 起点存在损坏的 `.git` 工作树元数据时，打开版本控制返回 `operation-failed`，并保留 Git 报告的具体失败原因。
- 仓库发现故障不会被误报为可静默降级的非 Git 目录。
