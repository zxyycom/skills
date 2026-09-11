### Case GATE-DISTRIBUTION-DEPENDENCY-001: Public distribution Checks 依赖当前生成 Check

Tests:
- `test:1373d858c910cb96d5feb720c97618ac622d32e3f67c5f48ede9a810f0cee70e`

Tags:
- `repository-tooling`

Contract:
- 面向 Change Plan、Decision Records 与 Task Graph 的 public-distribution Check 只在对应的当前生成 Check 成功后运行；provider status 由 Vibe 原生 `dependsOn` 结算，项目 adapter 不重复翻译失败。

Proves:
- 三个 consumer 分别依赖 `script:check:change-plan-cli`、`script:check:decision-records-cli` 与 `script:check:task-graph-cli`。
- 生成 Check 通过时 consumer 恰好运行一次；生成 Check failed 或 unavailable 时，Vibe 将 consumer 结算为 `dependency-not-passed` unavailable 且不启动测试命令。
