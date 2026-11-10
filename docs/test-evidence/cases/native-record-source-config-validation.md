### Case NATIVE-RECORD-SOURCE-CONFIG-VALIDATION-001: 非法来源设置在路由前失败

Tests:
- `test:0ebed6e86b7bd91c6904f7b2a96efb3290dc9dfe1f6013efe9c82eb6e5b59880`
- `test:bc9bccc489017ce2d988bf1103e3481cf3429e6c6fb33ce3738bd0a9c74dc9d7`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 合并后的 defaultKey 必须存在，来源组不得为空，investigationsDir 必须是安全的工作区相对路径；可选 defaultWriteKey 须为已有 key 且去重后恰好单源。

Proves:
- 配置加载分别拒绝未知 defaultKey、空来源组和 ../escape 调查目录，均返回 config-error。
- 写默认选定 one 时，同一份来源配置可正常加载；仅改为未知、空、多源、布尔或 null 的 defaultWriteKey 后，配置加载均返回 config-error。
