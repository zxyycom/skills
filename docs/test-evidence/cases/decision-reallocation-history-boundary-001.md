### Case DECISION-REALLOCATION-HISTORY-BOUNDARY-001: Evolve 区分先后重划事件

Tests:
- `test:611d8d9922358785622fcc8a6a55a2d24fe775c922451e45e0b52b547780bfef`

Tags:
- `decision-records`

Contract:
- 后续重划已归档的早先后继时，闭合计算必须区分同一 Decision ID 在早先事件中的后继角色和后来事件中的前序角色。

Proves:
- 纯已建立关系图一致性检查通过，并将早先与后来的事件分别投影为各自完整 predecessor/successor 集合，不要求跨事件混选。
