### Case MCPSHELL-BRIDGE-SHELL-002: workspace shell distinguishes target exit, timeout, and SSH transport failure

Tests:
- `test:154eb27170a0a24bdf5dcea68c3cacc215fd17499a0fa0728b862942feed678a`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- shell envelope 必须借远端 status marker 区分包括 exit 255 在内的目标非零、helper bounded timeout 和缺 marker 的 SSH transport failure，并保留可行动证据。

Proves:
- target exit 7 与 255 都返回 `target_exit` 和原 exit code；sleep 1 在 10 ms timeout 加有界 TERM/KILL grace 内返回 `timeout`；fixture SSH 255 且无 marker 返回 `transport_failure`。
