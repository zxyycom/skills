### Case DECISION-REALLOCATION-ROLE-BOUNDARY-001: 重划图的角色边界

Tests:
- `test:7b51c6051faa3cf1fc1d60e8b03cdc2957686f8099d43631b1ae0db5eacc288f`

Tags:
- `decision-records`

Contract:
- 单一重划事件中不得把同一 ID 同时作为前序和后继。

Proves:
- 原生索引图测试在原前序增加重划边导致角色重叠并拒绝该图；未断言具体错误原因或事务写入。
