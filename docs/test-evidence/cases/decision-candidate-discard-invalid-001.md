### Case DECISION-CANDIDATE-DISCARD-INVALID-001: Discard 拒绝生命周期或正文无效的候选

Tests:
- `test:8e21466c1d5a2df4866174d35e4997ebd67ba3f64f0ab61e2fd08c310e077fb4`

Tags:
- `decision-records`

Contract:
- discard 要求候选生命周期字段及必需正文结构合法。

Proves:
- candidate 的 alignment 非空、createdAt 非空或缺少决策章节时均拒绝丢弃，来源及正式索引原字节保持。
