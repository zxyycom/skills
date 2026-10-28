### Case WRITE-CANONICAL-CASE-010: 构建后冻结仍按当前顺序序列化

Tests:
- `test:fbe0eba3a9a16ffe1c4388748ad44cc0a304e5b31212ff18ff6989397eec0e39`

Tags:
- `write-canonical`

Contract:
- 不可信定义在 build 后变化并冻结时仍按原公开序列化语义处理。

Proves:
- readRevision 改变并冻结规则，验证输出字段顺序。
