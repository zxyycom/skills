### Case NATIVE-RECORD-SOURCE-CONFIG-VALIDATION-001: 非法来源设置在路由前失败

Tests:
- `test:bc9bccc489017ce2d988bf1103e3481cf3429e6c6fb33ce3738bd0a9c74dc9d7`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 合并后的 defaultKey 必须存在，来源组不得为空，investigationsDir 必须是安全的工作区相对路径。

Proves:
- 配置 API 分别拒绝未知 defaultKey、空来源组及 ../escape 调查目录，均返回 config-error；这些规则矩阵不通过真实 CLI 重复运行。
