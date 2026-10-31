### Case DECISION-LIFECYCLE-EXISTING-GUARD-001: 既有活动决策拒绝不适用的生命周期动作

Tests:
- `test:4cf97fb2c1c79367cd1a7b3b2b7924b90c0ddd1d6904413a27248e712574a47d`

Tags:
- `decision-records`

Contract:
- reactivate 仅接受归档决策，publish 仅建立候选。

Proves:
- 活动记录的 reactivate 与 publish 均返回对应领域错误，原 Markdown 与索引字节不变。
