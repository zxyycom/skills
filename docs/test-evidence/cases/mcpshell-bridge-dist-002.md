### Case MCPSHELL-BRIDGE-DIST-002: generated MCPShell definitions expose the four fixed-root operations

Tests:
- `test:634b8a7f713533d1f63443b552792e075a28239941a5cbf013c043601cc65be8`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 分发 YAML 必须定义四项固定根 operation，不暴露 backend 或 project root 日常参数，并为内部 deadline 保留 shell/patch 2 分钟、put/get 5 分钟的外层预算。

Proves:
- YAML 的 tool names 精确为 shell、apply-patch、put、get，file replace 默认 false，run timeout 顺序为 2m、2m、5m、5m。
