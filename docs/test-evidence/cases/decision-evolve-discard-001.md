### Case DECISION-EVOLVE-DISCARD-001: Evolve 以显式最终关系删除中间决策

Tests:
- `test:d96dd2e98b75f3c8cce0439415693809fa9aa0740b76e5c4b9ae2329ed120102`

Tags:
- `decision-records`

Contract:
- `evolve --discard` 删除无引用决策，并把调用方提供的关系作为后继完整最终关系集合。

Proves:
- 删除目标从 Markdown 和派生索引移除；后继采用显式最终关系且严格检查通过。
