### Case NATIVE-RECORD-TXN-OUTCOME-001: 事务准备和输出状态事实

Tests:
- `test:44fc660aac9cf6d6fabb241fe453a761f86e2c4eb2b693d76e9cf8ffa52c2296`

Tags:
- `record-rust`

Contract:
- Stage 输出须区分失败、未知和已提交事实，不将未知或已写状态描述为无变化。

Proves:
- 局部 stage 结果验证失败、未知与已提交后的 changed 映射。
