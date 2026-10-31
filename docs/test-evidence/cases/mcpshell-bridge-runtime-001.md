### Case MCPSHELL-BRIDGE-RUNTIME-001: workspace selects operation-specific runtime deadlines

Tests:
- `test:73006b0c03f18d5c0a2465a754679067135aefcc02b10bbe3adc5bf14fa148e0`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 未显式提供 `RuntimeOptions.timeoutMs` 时，shell/apply-patch 的 SSH helper deadline 为 110 秒，put/get 为 290 秒。

Proves:
- 记录四种 operation 实际注册的 SSH timeout，顺序为 110000、110000、290000、290000。
