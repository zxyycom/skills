### Case DECISION-SPLIT-OMISSION-001: 拆分扩充拒绝遗漏既有后继

Tests:
- `test:c4f68b6f910843204ea7ed757acb56c82e9282aac5777faf3e8824884a418f21`

Tags:
- `decision-records`

Contract:
- 拆分扩充须显式选择最终事件的全部直接后继。

Proves:
- 原生预检在两既有拆分后继中只选一个并新增第三个时拒绝，索引与两份旧来源字节不变。
