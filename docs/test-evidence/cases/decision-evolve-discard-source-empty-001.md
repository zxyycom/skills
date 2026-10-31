### Case DECISION-EVOLVE-DISCARD-SOURCE-EMPTY-001: Evolve discard 接受来源为空的最终关系

Tests:
- `test:cf199beb47b15e0c523864903cebdb103449715d0fd2cf12bcacead20508704d`

Tags:
- `decision-records`

Contract:
- 未提供关系覆盖时，所选后继使用自身来源关系；来源为空即为空最终关系，不额外要求 `--clear-relations`。

Proves:
- 关系为空的后继可与删除目标在同一事务完成。
