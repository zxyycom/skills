### Case DECISION-LOCAL-MAINTENANCE-ACTIONS-001: 候选丢弃隔离未选正式正文

Tests:
- `test:bd61f36aa09436cb6a8f2b7c9b647fed5e6f732ef0824b3f6943055bc474424c`

Tags:
- `decision-records`

Contract:
- 普通候选 discard 使用发布索引，不替未选正式正文证明当前性。

Proves:
- 未选正式正文损坏时带该正式目标关系的候选仍可丢弃，未选正文和正式索引字节不变。
