### Case DECISION-REALLOCATION-COST-001: 重划闭包查较小集合

Tests:
- `test:d0ac0344584b432dc948c59eb6f6f60722f9992f9285a6cc50444805897db490`

Tags:
- `decision-records`

Contract:
- 重划闭包可通过查询较小成员集合寻找与所选后继相交的分量。

Proves:
- 两个小型不相交旧分量和较大的选中集合场景中，按旧分量成员查询而不对旧分量逐个查询选中 ID。
