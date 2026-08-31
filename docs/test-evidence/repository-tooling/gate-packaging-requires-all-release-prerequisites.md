### Case GATE-FULL-PACKAGING-001: full 打包只在全部发布前置通过后运行一次

Entry:
- `scripts/vibe-check.test.ts > full packaging runs once only after every release prerequisite passes`
- `bun test --test-name-pattern="^full packaging runs once only after every release prerequisite passes$" ./scripts/vibe-check.test.ts`

Contract:
- `pack:skills` 只属于 full，直接依赖全部 release-required Check；全部 passed 时恰好运行一次，任何 failed 或 unavailable 前置都零调用，打包失败使 aggregate failed。

Proves:
- default 不声明或调用 `pack:skills`；成功 full 仅调用一次，并在隔离 `dist/` 写入本次 fixture 制品。
- 项目脚本或 native blocking 前置 failed/unavailable，以及 required advisory 指标 unavailable/not-applicable，都不会调用打包或留下本次隔离制品；打包自身非零退出决定 aggregate failed。
