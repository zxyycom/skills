### Case DECISION-CANDIDATE-DISCARD-ACTIVE-TARGET-001: Discard 接受指向活动目标的合法候选

Tests:
- `test:bd61f36aa09436cb6a8f2b7c9b647fed5e6f732ef0824b3f6943055bc474424c`

Tags:
- `decision-records`

Contract:
- 候选指向活动正式目标不妨碍丢弃候选；正式索引不变。

Proves:
- 带活动目标修订关系的候选被成功丢弃，正式索引字节不变，即使未选正式目标正文已损坏。
