### Case MCPSHELL-BRIDGE-RUNTIME-001: workspace selects operation-specific runtime deadlines

Tests:
- `test:f113dde6a42fbf4cbfd41e88fdbebff3a7c57751ef1f0503353bf075f75be6ce`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 未显式提供 `RuntimeOptions.timeoutMs` 时，shell/apply-patch 的 SSH helper deadline 为 110 秒，put/get 为 290 秒。

Proves:
- 记录四种 operation 实际注册的 SSH timeout，顺序为 110000、110000、290000、290000。
