### Case WRITE-CANONICAL-CASE-009: 准备后定义变化被拒绝

Tests:
- `test:efa3abdc89053d33c4fccbc02b3580a9c8b7e755ce223a26eeb718183cbac35f`

Tags:
- `write-canonical`

Contract:
- prepared 的定义身份及原规则不能被后续冻结替代。

Proves:
- 改变定义字段顺序并冻结后验证 preparation-mismatch 和零写入。
