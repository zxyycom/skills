### Case WRITE-CANONICAL-CASE-009: 准备后定义变化被拒绝

Tests:
- `test:4435984af3c73c2585464f1a43ded2cb5dce53674fbc7b421a15f892c03a09a1`

Tags:
- `write-canonical`

Contract:
- prepared 的定义身份及原规则不能被后续冻结替代。

Proves:
- 改变定义字段顺序并冻结后验证 preparation-mismatch 和零写入。
