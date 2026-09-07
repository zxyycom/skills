### Case MCPSHELL-BRIDGE-INIT-010: initializer rejects another owned identity until it is removed

Tests:
- `test:60604662f50e3e01417f894207d39faa382b3464bc1d56fb7932b9f70561198c`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 单例 `.env.mcpshell` 只能服务一个 active bridge-owned identity；另一 owned identity 存在时 preview/apply 必须冲突停止，操作者精确 remove 旧 identity 后才能切换。

Proves:
- preview 和 apply 都返回 `config_conflict`，并保持旧 registration 与 env 字节不变。
- remove 旧 identity 后，新 identity 的 apply 可以创建其 registration。
