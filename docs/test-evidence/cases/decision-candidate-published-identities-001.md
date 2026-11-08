### Case DECISION-CANDIDATE-PUBLISHED-IDENTITIES-001: 候选查询使用合法发布身份并隔离未选正文

Tests:
- `test:06ce3f83d2e8787e27fd38c77dfa9b3e5641685d9878b09c7e72a103076235a6`

Tags:
- `decision-records`

Contract:
- 候选查询使用合法发布索引，不以未选正式正文健康为前提；已存在正式来源但缺失或损坏索引时不隐式恢复。

Proves:
- 真实 CLI 在未选正式正文损坏时仍列出和展示候选；坏索引或缺索引且存在正式来源时两个查询均失败。
