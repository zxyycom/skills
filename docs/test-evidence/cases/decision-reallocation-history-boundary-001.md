### Case DECISION-REALLOCATION-HISTORY-BOUNDARY-001: Evolve 区分先后重划事件

Tests:
- `test:3f452bc3e5212dd1e42597cfbc32899b7ecb3e3b6d2beac0c5e7acb652ce74e1`

Tags:
- `decision-records`

Contract:
- 后续重划已归档的早先后继时，闭合计算必须区分同一 Decision ID 在早先事件中的后继角色和后来事件中的前序角色。

Proves:
- 纯已建立关系图一致性检查通过，并将早先与后来的事件分别投影为各自完整 predecessor/successor 集合，不要求跨事件混选。
