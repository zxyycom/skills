### Case DECISION-REALLOCATION-PURITY-001: Evolve 拒绝混合重划关系

Tests:
- `test:86dc78286535129cc283a322443f84703c39a9eb40d2d436be10b3706a42c47c`

Tags:
- `decision-records`

Contract:
- 重划事务的每个后继都必须有重划关系，且不得混用其他关系类型。

Proves:
- 纯事务准备对后继混合重划与修订关系返回 error、exitCode=1，诊断每个后继须有重划且不能有其他类型，且不产生 changes。
