### Case DECISION-REALLOCATION-HISTORY-BOUNDARY-001: Evolve 区分先后重划事件

Tests:
- `test:611d8d9922358785622fcc8a6a55a2d24fe775c922451e45e0b52b547780bfef`

Tags:
- `decision-records`

Contract:
- 后续重划已归档的早先后继时，闭合计算必须区分同一 Decision ID 在早先事件中的后继角色和后来事件中的前序角色。

Proves:
- 新的两个后继可以围绕旧后继和另一前序建立完整连通分量，不会被要求同时选择早先事件的其他后继。
- 合并后的已建立关系图通过严格检查。
