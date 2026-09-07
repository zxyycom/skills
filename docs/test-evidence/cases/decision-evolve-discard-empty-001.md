### Case DECISION-EVOLVE-DISCARD-EMPTY-001: Evolve discard 接受显式空的最终关系集合

Tests:
- `test:6ab5b3010a76d6ab630ef909b76831c6d966c98d58cea9ddff5f447f8aa2a3b9`

Tags:
- `decision-records`

Contract:
- `--clear-relations` 将所选后继的完整最终关系替换为空，并可与 `--discard` 同一事务使用。

Proves:
- 事务删除目标并建立关系为空的后继。
