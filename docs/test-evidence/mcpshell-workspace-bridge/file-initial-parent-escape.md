### Case MCPSHELL-BRIDGE-FILE-011: workspace put rejects an initial physical parent outside the project

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace put rejects an initial physical parent outside the project`
- `bun test --test-name-pattern="^workspace put rejects an initial physical parent outside the project$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- put 在 remote physical destination parent 的初始 containment 检查失败时，尚未创建或提交 temporary，必须返回确定的 `path_rejected`，不能落入 commit-ack 的 `outcome_unknown`。

Proves:
- fixture 将 project 内 `link` 指向 `../outside`；`link/escaped.txt` 返回 `path_rejected` 和稳定 diagnostic，outside 不出现 destination。
