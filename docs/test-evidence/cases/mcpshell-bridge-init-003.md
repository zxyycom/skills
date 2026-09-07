### Case MCPSHELL-BRIDGE-INIT-003: initializer stops on an unowned identity and removes only owned configuration

Tests:
- `test:22b1fbba09cb7cf7b41b2a3cea3ecea1615877184a0ae4214e33159271d0e865`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 同名但未带 bridge 拥有标记的 table 必须冲突停止；remove 只能删除已拥有 identity 和显式要求的 env。

Proves:
- 同名未受管 table 的冲突在 env 与 TOML 写入前停止，并保留原 TOML。
- 受管 table 与 `--remove-env` 的 env 被移除，而无关字节保留。
