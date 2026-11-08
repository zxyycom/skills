### Case DECISION-CANDIDATE-INDEX-CONTEXT-001: 候选查询拒绝缺失正式基线并隔离来源漂移

Tests:
- `test:06ce3f83d2e8787e27fd38c77dfa9b3e5641685d9878b09c7e72a103076235a6`

Tags:
- `decision-records`

Contract:
- 已有正式来源时坏或缺索引需恢复；合法索引下未选正式正文损坏不阻断候选读取。

Proves:
- 真实 CLI 的 candidates/show-candidate 在未选正式正文损坏时成功；索引损坏或缺失且有正式来源时两者均失败。
