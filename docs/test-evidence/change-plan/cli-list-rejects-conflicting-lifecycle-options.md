### Case CHANGE-PLAN-CLI-LIST-ARGS-001: List CLI 拒绝冲突的生命周期选项
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI list rejects conflicting lifecycle options`
- `bun test --test-name-pattern="^CLI list rejects conflicting lifecycle options$" ./tools/change-plan/tests/run.ts`
Contract:
- List CLI 的 `--archived` 与 `--all` 互斥，冲突组合属于参数错误。
Proves:
- 同时传入两个选项时命令退出 2，并在 stderr 返回互斥诊断。
