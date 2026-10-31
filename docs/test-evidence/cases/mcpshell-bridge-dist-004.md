### Case MCPSHELL-BRIDGE-DIST-004: generated runtime renders missing and malformed configuration as JSON envelopes

Tests:
- `test:05138e8064ec5edb2c99de05e4b21e8f737efbb5d94e07f9d62b82d13e3d9c66`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 分发 runtime 的每一项 operation 在缺失或无效 `.env.mcpshell` 时都必须 stdout JSON envelope、外层 status 0，并给出稳定 `config_invalid`。

Proves:
- 对 shell、apply-patch、put-file、get-file 分别以缺失和空 backend 的 env 运行 Node CLI；每次 status 为 0，JSON 为非成功的 `config_invalid`。
