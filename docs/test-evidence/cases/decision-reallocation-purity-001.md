### Case DECISION-REALLOCATION-PURITY-001: Evolve 拒绝混合重划关系

Tests:
- `test:d7336aad16283e4c8bf90b8246638ccb9638a4c83d84f9669ef6c0678a9cf12c`

Tags:
- `decision-records`

Contract:
- 重划事务的每个后继都必须有重划关系，且不得混用其他关系类型。

Proves:
- 纯事务准备对后继混合重划与修订关系返回 error、exitCode=1，诊断每个后继须有重划且不能有其他类型，且不产生 changes。
