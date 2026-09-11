### Case MCPSHELL-BRIDGE-FILE-005: workspace put rejects a verified parent moved outside the project and cleans its transfer

Tests:
- `test:4c84f5d3c17205a364461658de0e45f80b064567850e1766f734f8742a429837`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 在 physical parent 验证后仍必须在提交前和提交后重新确认 cwd 位于 project root；发现 parent 被移出 root 时必须清理 temporary 或已提交 basename，并返回稳定 `path_rejected`。

Proves:
- fixture 在 remote temporary 出现后把 parent 移到 project 外并在原位置重建目录；result 为 `path_rejected`，移出的 parent 没有 destination，重建的项目目录为空，agent staging source 保持不变。
