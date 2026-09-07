### Case DECISION-REALLOCATION-PURITY-001: Evolve 拒绝混合重划关系

Tests:
- `test:2bbe6bceed2bb632692325221738c2a912359fe9dfaa05c76fea4491cfeee8df`

Tags:
- `decision-records`

Contract:
- 重划事务的每个后继都必须有重划关系，且不得混用其他关系类型。

Proves:
- 一个后继同时保存重划与修订关系时，evolve 在写入前拒绝该选择。
