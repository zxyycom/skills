### Case DECISION-REALLOCATION-SUCCESSOR-MINIMUM-001: 重划图至少两个后继

Tests:
- `test:7b51c6051faa3cf1fc1d60e8b03cdc2957686f8099d43631b1ae0db5eacc288f`

Tags:
- `decision-records`

Contract:
- 重划图须有至少两个直接后继。

Proves:
- 原生索引图验证接受稀疏的两前序两后继图；移除一个后继的重划边后拒绝该图。该测试不检查事务错误码或写入。
