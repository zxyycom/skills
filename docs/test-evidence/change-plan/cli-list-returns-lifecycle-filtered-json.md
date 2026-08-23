### Case CHANGE-PLAN-CLI-LIST-001: List CLI 返回生命周期筛选后的 JSON
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI list returns lifecycle-filtered JSON`
- `bun test --test-name-pattern="^CLI list returns lifecycle-filtered JSON$" ./tools/change-plan/tests/run.ts`
Contract:
- List CLI 必须支持按活动/归档状态列出 Change，并允许活动条目继续按生命周期阶段筛选。
Proves:
- `--all --json` 同时返回 active 与 archived 条目；`--stage plan --json` 只返回 Plan 条目。
- Archived JSON entry 只包含 `changeDirectory`、`changeName` 与 `status`，不投影 active 检查字段。
