### Case DECISION-EVOLVE-DISCARD-EMPTY-001: Evolve discard 接受显式空的最终关系集合

Tests:
- `test:31ba169f4e942f3283814ca5411e4bfd081230f37b38ec070b48bb9c9589c65f`

Tags:
- `decision-records`

Contract:
- `--clear-relations` 将所选后继的完整最终关系替换为空，并可与 `--discard` 同一事务使用。

Proves:
- 事务删除目标并建立关系为空的后继。
