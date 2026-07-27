### Case CHANGE-PLAN-CLI-LIST-001: List CLI 返回生命周期筛选后的 JSON
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI list returns lifecycle-filtered JSON`
- `bun test --test-name-pattern="^CLI list returns lifecycle-filtered JSON$" ./tools/change-plan/tests/run.ts`
Contract:
- List CLI 的 `--all --json` 必须返回活动和归档计划及各自生命周期状态。
Proves:
- 命令退出 0、stderr 为空，JSON 同时包含 active 与 archived 条目。
