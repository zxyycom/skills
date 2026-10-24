### Case MCPSHELL-BRIDGE-FILE-005: workspace put rejects a verified parent moved outside the project and cleans its transfer

Tests:
- `test:4c84f5d3c17205a364461658de0e45f80b064567850e1766f734f8742a429837`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 在 physical parent 验证后仍必须在提交前和提交后重新确认 cwd 位于 project root；发现 parent 被移出 root 时必须清理 temporary 或已提交 basename，并返回稳定 `path_rejected`。

Proves:
- 确认已验证 cwd 且 receive 完成后，在 wc 提交前同步把 parent 移出 root 并重建原路径，外层 event 命中；返回 path_rejected，移出/重建目录均空，staging source 字节不变。
