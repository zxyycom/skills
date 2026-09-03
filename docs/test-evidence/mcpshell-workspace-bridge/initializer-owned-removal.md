### Case MCPSHELL-BRIDGE-INIT-003: initializer stops on an unowned identity and removes only owned configuration

Entry:
- `tools/mcpshell-workspace-bridge/tests/initializer.test.ts > initializer stops on an unowned identity and removes only owned configuration`
- `bun test --test-name-pattern="^initializer stops on an unowned identity and removes only owned configuration$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- 同名但未带 bridge 拥有标记的 table 必须冲突停止；remove 只能删除已拥有 identity 和显式要求的 env。

Proves:
- 冲突保留原 TOML；受管 table 与 `--remove-env` 的 env 被移除，而无关字节保留。
