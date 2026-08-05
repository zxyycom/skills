### Case CHECK-FULL-PROFILE-001: full 档运行全部检查
Entry:
- `scripts/check.test.ts > workflow runs every check in the full profile`
- `bun test --test-name-pattern="^workflow runs every check in the full profile$" ./scripts/check.test.ts`
Contract:
- full 档必须运行 quick 与 full 的全部前置任务，全部通过后再打包。
Proves:
- 两个档位的任务和打包按计划执行。
- 成功的 full 工作流不产生 skipped 结果。
