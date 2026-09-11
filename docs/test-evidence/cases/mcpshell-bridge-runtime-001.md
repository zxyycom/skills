### Case MCPSHELL-BRIDGE-RUNTIME-001: workspace selects operation-specific runtime deadlines

Tests:
- `test:2796922e44516e8c343fd6257fb98f2fb1b99e32420686b575341bb8c1e501d5`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 未显式提供 `RuntimeOptions.timeoutMs` 时，shell/apply-patch 的 SSH helper deadline 为 110 秒，put/get 为 290 秒。

Proves:
- 记录四种 operation 实际注册的 SSH timeout，顺序为 110000、110000、290000、290000。
