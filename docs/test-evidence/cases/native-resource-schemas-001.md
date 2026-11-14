### Case NATIVE-RESOURCE-SCHEMAS-001: 资源包与冻结发布的双 Schema 完整性

Tests:
- `test:0075ef86bb1b5dc563396d863e95bce0558b7fe0eba6612d0d72d3034794fa0d`
- `test:be182c4418f6b8f19a643f30d75440f7bcdbb740d0b50f71336dd587952b243c`

Tags:
- `native-delivery`

Contract:
- 资源 skill 包必须同时包含 record 与 index 两个 Schema；发布验证从冻结 delivery 读取角色所需全部 Schema。

Proves:
- 独立包 fixture 在两个 Schema 齐备时可准备，缺任一文件均被拒绝。
- 发布输入从隔离冻结目录按角色读取两个旧 Schema 和两个资源 Schema，缺失资源索引 Schema 失败；不访问网络。
