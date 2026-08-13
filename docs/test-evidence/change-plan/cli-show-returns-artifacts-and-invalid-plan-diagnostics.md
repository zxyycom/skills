### Case CHANGE-PLAN-CLI-SHOW-001: Show CLI 返回制品与无效计划诊断
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI show returns artifacts and invalid-plan diagnostics`
- `bun test --test-name-pattern="^CLI show returns artifacts and invalid-plan diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- Show CLI 同时呈现生命周期状态、阶段、Git 距离提示、计划制品和当前有效性诊断。
Proves:
- 有效 Plan 的文本输出包含 active、plan 与“未统计到 Change 目录外的项目变化”提示；无效 Change 的 JSON 仍返回缺失制品及检查失败。
