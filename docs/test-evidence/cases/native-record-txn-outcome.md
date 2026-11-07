### Case NATIVE-RECORD-TXN-OUTCOME-001: 事务准备和输出状态事实

Tests:
- `test:af901ea0968947244034935c6a1a26a6729b7ac341c854980fa74ea7c8a2e30f`

Tags:
- `record-rust`

Contract:
- Stage 输出须区分失败、未知和已提交事实，不将未知或已写状态描述为无变化。

Proves:
- 局部 stage 结果验证失败、未知与已提交后的 changed 映射。
