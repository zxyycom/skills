### Case WRITE-CANONICAL-CASE-010: 构建后冻结仍按当前顺序序列化

Tests:
- `test:c0453234435abded06110cabeb32877d32cbcbeb640961ff569e5d7895c4edcb`

Tags:
- `write-canonical`

Contract:
- 不可信定义在 build 后变化并冻结时仍按原公开序列化语义处理。

Proves:
- readRevision 改变并冻结规则，验证输出字段顺序。
