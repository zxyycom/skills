### Case DECISION-DISCARD-INVALID-ESTABLISHED-SOURCE-001: 局部候选删除不验证未选正式正文

Tests:
- `test:bd61f36aa09436cb6a8f2b7c9b647fed5e6f732ef0824b3f6943055bc474424c`

Tags:
- `decision-records`

Contract:
- 候选 discard 不以未选正式正文的当前健康状态为门禁。

Proves:
- 未选正式目标正文损坏时，丢弃所选候选仍成功，损坏正文与正式索引字节保持。
