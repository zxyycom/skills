### Case DECISION-LIFECYCLE-EXISTING-GUARD-001: 既有活动决策拒绝不适用的生命周期动作

Tests:
- `test:f24ec5fef43d28e5f63c85cd8ebd05949927470d3306c4e7e41373eb501e333d`

Tags:
- `decision-records`

Contract:
- reactivate 仅接受归档决策，publish 仅建立候选。

Proves:
- 活动记录的 reactivate 与 publish 均返回对应领域错误，原 Markdown 与索引字节不变。
