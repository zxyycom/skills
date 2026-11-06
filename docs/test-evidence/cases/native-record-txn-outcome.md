### Case NATIVE-RECORD-TXN-OUTCOME-001: 事务准备和输出状态事实

Tests:
- `test:24a8d16cf936d47b3b2723707a303440ee87f9dceb0a8d65f8e3b9fc7e346cc8`
- `test:a18268a1c56245d08449ad1b26026b9622db188147eb258055a0b0d4f5fe5987`
- `test:af901ea0968947244034935c6a1a26a6729b7ac341c854980fa74ea7c8a2e30f`

Tags:
- `record-rust`

Contract:
- 事务准备失败须保留诊断并明确无写，不以计划代替已提交结果。

Proves:
- 局部阶段注入验证计划、诊断字段、未知恢复和实际提交状态映射。
