### Case MCPSHELL-BRIDGE-FILE-005: workspace put rejects a verified parent moved outside the project and cleans its transfer

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace put rejects a verified parent moved outside the project and cleans its transfer`
- `bun test --test-name-pattern="^workspace put rejects a verified parent moved outside the project and cleans its transfer$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- put 在 physical parent 验证后仍必须在提交前和提交后重新确认 cwd 位于 project root；发现 parent 被移出 root 时必须清理 temporary 或已提交 basename，并返回稳定 `path_rejected`。

Proves:
- fixture 在 remote temporary 出现后把 parent 移到 project 外并在原位置重建目录；result 为 `path_rejected`，移出的 parent 没有 destination，重建的项目目录为空，agent staging source 保持不变。
