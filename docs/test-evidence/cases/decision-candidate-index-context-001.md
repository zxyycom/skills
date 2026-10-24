### Case DECISION-CANDIDATE-INDEX-CONTEXT-001: 候选查询拒绝缺失正式基线并隔离来源漂移

Tests:
- `test:4aac2fac7fc8f421805cfa29d69d2c83590808b8055f51351bbf2d1fa5185996`

Tags:
- `decision-records`

Contract:
- 已有正式来源时，缺失或损坏索引须显式恢复；合法发布基线下未选正文漂移不阻断候选读取。

Proves:
- 缺失和 invalid JSON 场景的 candidates/show-candidate 均退出 1 并提示显式恢复；同一来源发生 stale 正文漂移但索引合法时，两个查询均返回所选候选。
