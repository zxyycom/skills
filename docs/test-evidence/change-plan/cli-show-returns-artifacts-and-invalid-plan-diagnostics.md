### Case CHANGE-PLAN-CLI-SHOW-001: Show CLI 返回制品与无效计划诊断
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI show returns artifacts and invalid-plan diagnostics`
- `bun test --test-name-pattern="^CLI show returns artifacts and invalid-plan diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- Show CLI 必须同时呈现计划制品和当前有效性诊断。
Proves:
- 已知有效与无效计划都可查询，且无效状态不会被隐藏。
