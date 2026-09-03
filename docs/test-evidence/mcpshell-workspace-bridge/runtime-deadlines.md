### Case MCPSHELL-BRIDGE-RUNTIME-001: workspace selects operation-specific runtime deadlines

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace selects operation-specific runtime deadlines`
- `bun test --test-name-pattern="^workspace selects operation-specific runtime deadlines$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- 未显式提供 `RuntimeOptions.timeoutMs` 时，shell/apply-patch 的 SSH helper deadline 为 110 秒，put/get 为 290 秒。

Proves:
- 记录四种 operation 实际注册的 SSH timeout，顺序为 110000、110000、290000、290000。
