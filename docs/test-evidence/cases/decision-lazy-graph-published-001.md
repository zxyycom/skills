### Case DECISION-LAZY-GRAPH-PUBLISHED-001: 发布快照查询复用严格校验图

Tests:
- `test:09f3e30368bfcb24cebe3640ddefc8f0b5fa993350ae98e7ac10eaca953c96bf`

Tags:
- `decision-records`

Contract:
- 发布快照查询必须保留严格完整关系校验，并在同一操作内复用该图执行 trace 或关系筛选。

Proves:
- 普通 list、show、trace、metadata search 与带关系条件的 list、metadata search 各实际构图一次。
- 成员数、关系证据、trace coverage、正文与发布来源保持正确，公开结果不携带 provider。
