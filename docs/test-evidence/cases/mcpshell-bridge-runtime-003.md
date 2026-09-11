### Case MCPSHELL-BRIDGE-RUNTIME-003: workspace put preserves verification evidence after a post-commit output limit

Tests:
- `test:5cb270e2c730a893a29532b565fba3c99b2976f71f110ca942d90b17c3dd79f4`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 在 remote final commit 后发生文本输出超限时，不能把实际写入误报为普通 `output_limit`；必须返回 `outcome_unknown`，并提供 destination、预期 bytes、SHA-256 与 output-limit cause，使调用方能先在目标核验而非盲目 replace 重传。

Proves:
- 隔离 SSH 先执行完整 remote put，再向 stderr 写入超过 1 MiB 的内容；result 为 `outcome_unknown`，evidence 含预期 destination、bytes、SHA-256、cause、stream 和 limit，目标文件仍等于 source bytes。
