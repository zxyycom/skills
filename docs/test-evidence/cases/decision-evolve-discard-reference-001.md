### Case DECISION-EVOLVE-DISCARD-REFERENCE-001: 删除不自动改写未选候选

Tests:
- `test:18c042b1249b872ffda1f29bcd991ee2e4f97a3762bef802bb689cb699a6de10`

Tags:
- `decision-records`

Contract:
- 未选候选不随删除自动改写，之后发布须重新校验目标。

Proves:
- 同次事务删除目标时未选引用候选字节不变；随后该候选发布预检失败、来源与索引字节不变。
