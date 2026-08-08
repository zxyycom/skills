### Case CHANGE-PLAN-CLI-LIFECYCLE-001: 生命周期 CLI 只执行合法阶段转换
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI lifecycle commands enforce legal stage transitions`
- `bun test --test-name-pattern="^CLI lifecycle commands enforce legal stage transitions$" ./tools/change-plan/tests/run.ts`
Contract:
- CLI 必须沿 draft 到 plan 到 implementation 的合法路径推进，并以显式原因搁置 plan；恢复后必须重新复核计划，不能直接实施。
Proves:
- 合法推进写入对应阶段，显式搁置保存原因，恢复产生空基线的 plan 与 `plan-review-required`，随后直接 implement 被拒绝。
