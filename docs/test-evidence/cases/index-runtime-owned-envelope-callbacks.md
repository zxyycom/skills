### Case INDEX-RUNTIME-ENVELOPE-CALLBACKS-001: 领域 parser 只接收递归冻结的 envelope 输入

Tests:
- `test:5bbc13f4f816ef88241d738f2daf37bdc413161f85bb70ee38b3dc1eb2278244`

Tags:
- `index-runtime`

Contract:
- 领域 metadata/state parser 及完整索引 validator 接收只读快照；冻结不能等到 callback 之后。

Proves:
- 在 callback 内记录 metadata/state/context/index 的递归冻结及嵌套修改失败，外层核对全部观察、原始内容和完整序列化结果。
