### Case INDEX-RUNTIME-ENVELOPE-CALLBACKS-001: 领域 parser 只接收递归冻结的 envelope 输入

Tests:
- `test:eaccb31619b49ae922282b6751f1634866885989bc30af5f0623c77b7720962d`

Tags:
- `index-runtime`

Contract:
- 领域 metadata/state parser 及完整索引 validator 接收只读快照；冻结不能等到 callback 之后。

Proves:
- 在 callback 内记录 metadata/state/context/index 的递归冻结及嵌套修改失败，外层核对全部观察、原始内容和完整序列化结果。
