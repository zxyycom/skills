### Case WRITE-CANONICAL-CASE-015: 冻结代理保持公开序列化行为

Tests:
- `test:fa1e9835f9461166f4b51e976621dfe83f5826804e3573d503bbfcf9bcae317f`

Tags:
- `write-canonical`

Contract:
- 冻结代理不可仅凭属性描述符获取规范结果复用资格。

Proves:
- 真实同步使用自有稳定排序数据的冻结代理，代理拒绝反射时仍成功写入。
