### Case DECISION-STATE-MEMORY-CYCLE-001: 内存来源拒绝关系环

Tests:
- `test:60804abb24395540aab301c73c90eaeb0b0093e1b434f81757ed517279a787bb`

Tags:
- `decision-records`

Contract:
- 快照构造必须拒绝闭环关系图。

Proves:
- 构造两记录的互相修订，断言 cycle 错误。
