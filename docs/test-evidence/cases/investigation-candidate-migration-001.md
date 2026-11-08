### Case INVESTIGATION-CANDIDATE-MIGRATION-001: 跨日同名候选与关系选择歧义

Tests:
- `test:e69da66b29e094f28020d5e95e6ee239f428954736cf573b63f004d407c2a9e1`

Tags:
- `investigation-report`

Contract:
- 不同日期的同名候选可分别建立；按名称引用存在歧义时不得静默选择。

Proves:
- 调查领域分别在两个日期创建 foo 均成功，随后以 foo.MD 作为关系 target 的创建失败且未变更。
