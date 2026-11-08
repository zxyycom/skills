### Case DECISION-EVOLVE-DISCARD-ARCHIVED-RELATION-001: 删除目标时可保留无关归档关系

Tests:
- `test:18c042b1249b872ffda1f29bcd991ee2e4f97a3762bef802bb689cb699a6de10`

Tags:
- `decision-records`

Contract:
- 删除目标不禁止后继引用其他合法已归档前序。

Proves:
- 同次事务删除独立目标，保留指向旧归档前序的关系并建立后继；归档来源字节保持。
