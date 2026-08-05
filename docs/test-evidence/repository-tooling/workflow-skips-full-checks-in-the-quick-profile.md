### Case CHECK-QUICK-PROFILE-001: quick 档显式跳过 full 检查
Entry:
- `scripts/check.test.ts > workflow skips full checks in the quick profile`
- `bun test --test-name-pattern="^workflow skips full checks in the quick profile$" ./scripts/check.test.ts`
Contract:
- quick 档只运行 quick 前置任务，并把每个 full 任务显式报告为 skipped。
Proves:
- full 任务没有执行且产生 skipped 结果。
- quick 任务通过后仍执行打包并返回成功。
