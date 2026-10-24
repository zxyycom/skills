### Case INVESTIGATION-CANDIDATE-MIGRATION-001: 允许跨日与 legacy 同名，不隐式迁移

Tests:
- `test:7f29569df5eb9b94c0b0cb8e47d0ea5de14fac96c0eb792ceb287c925483f4d8`

Tags:
- `investigation-report`

Contract:
- 完整日期 ID 和目标路径唯一；name 可以重复，新建不要求先迁移旧记录。

Proves:
- legacy 同名仍成功创建 canonical 日期 ID 候选，旧来源字节不变；同完整 ID 重试失败，跨日再次创建成功。
