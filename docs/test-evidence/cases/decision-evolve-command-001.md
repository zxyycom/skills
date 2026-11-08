### Case DECISION-EVOLVE-COMMAND-001: 单后继引用活动及归档前序

Tests:
- `test:18c042b1249b872ffda1f29bcd991ee2e4f97a3762bef802bb689cb699a6de10`

Tags:
- `decision-records`

Contract:
- 单后继 evolve 可以同时使用合法活动及已归档前序，活动前序归档而已归档来源不变。

Proves:
- 原生事务的目标包括已归档 old-a 与活动 old-b；提交后 old-a 正文字节不变、old-b 归档，后继索引按输入顺序保存两条关系。
