### Case DECISION-REALLOCATION-PURITY-001: Evolve 拒绝混合重划关系

Tests:
- `test:86dc78286535129cc283a322443f84703c39a9eb40d2d436be10b3706a42c47c`

Tags:
- `decision-records`

Contract:
- 重划事务的每个后继都必须有重划关系，且不得混用其他关系类型。

Proves:
- 一个后继同时保存重划与修订关系时，evolve 在写入前拒绝该选择。
