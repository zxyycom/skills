### Case GATE-SCRIPT-ADAPTER-001: package-script adapter 映射终态且继续结算独立 Check

Entry:
- `scripts/vibe-check.test.ts > package script adapter maps terminal results and settles independent Checks`
- `bun test --test-name-pattern="^package script adapter maps terminal results and settles independent Checks$" ./scripts/vibe-check.test.ts`

Contract:
- 项目脚本必须以参数数组运行 `bun run <script>`；非零退出为 failed，无法启动等不可信终态为 unavailable，且一个脚本失败不能阻止无依赖的其他 Check 结算。

Proves:
- 注入的非零退出使 aggregate failed，同时独立脚本仍 passed。
- 注入的 unavailable 保留稳定 reason code 并使 aggregate failed；每次调用都使用 `bun` 和 `['run', script]` 参数数组。
