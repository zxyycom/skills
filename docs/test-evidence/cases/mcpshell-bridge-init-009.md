### Case MCPSHELL-BRIDGE-INIT-009: initializer requires complete CLI configuration flags

Tests:
- `test:bb7fa75a1fd6e0d46618cf1c13c5fb586892f964de7a3393f55ceb1ed616c4b0`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- preview/apply 的 CLI config flags 只能全部提供或全部省略；全省略交由已有 env 恢复，部分 flags 在进入写入流程前被拒绝。

Proves:
- 全部省略时 CLI request 的 config 为 undefined。
- 仅提供 backend 时 parser 返回可行动的 complete-group 错误。
