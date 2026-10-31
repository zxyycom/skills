### Case WRITE-CANONICAL-CASE-015: 冻结代理保持公开序列化行为

Tests:
- `test:9e62db8a5255c66614ac9edc3ee4a52137385c75635141c2b60080d3ee2c9b9b`

Tags:
- `write-canonical`

Contract:
- 冻结代理不可仅凭属性描述符获取规范结果复用资格。

Proves:
- 真实同步使用自有稳定排序数据的冻结代理，代理拒绝反射时仍成功写入。
