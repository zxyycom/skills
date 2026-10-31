### Case MCPSHELL-BRIDGE-INIT-011: initializer previews and applies the same update actions

Tests:
- `test:b49701f3a640201b53ff4747b65e37e5168066df29f8deaa06a18138bfd7d38e`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 对已有但过时的 env 与受管 registration，preview 和 apply 必须共享同一无敏感值 `update` plan；preview 不写入，apply 才执行该 plan。

Proves:
- 两次结果均为 env 与 registration 的 `update` actions，且 preview 不回显旧配置或 root。
- preview 保留旧 env/TOML 字节；apply 写入新的 env 与受管 registration。
