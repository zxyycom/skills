### Case GATE-DISTRIBUTION-DEPENDENCY-001: Public distribution Checks 依赖当前生成 Check

Entry:
- `scripts/vibe-check.test.ts > public distribution Checks require successful generation Checks`
- `bun test --test-name-pattern="^public distribution Checks require successful generation Checks$" ./scripts/vibe-check.test.ts`

Contract:
- 面向 Change Plan、Decision Records 与 Task Graph 的 public-distribution Check 只在对应的当前生成 Check 成功后运行，避免以漂移或不可用的分发制品继续测试。

Proves:
- 三个 consumer 分别依赖 `script:check:change-plan-cli`、`script:check:decision-records-cli` 与 `script:check:task-graph-cli`。
- 生成 Check 通过时 consumer 恰好运行一次；生成 Check failed 或 unavailable 时 consumer 继承该终态且不启动测试命令。
