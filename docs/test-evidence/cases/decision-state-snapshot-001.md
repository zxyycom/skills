### Case DECISION-STATE-SNAPSHOT-001: 状态快照与后续源变更隔离

Tests:
- `test:b6e590bc020128a68ad283801f586fd5bc9643f63dd60de243ba77056da49189`

Tags:
- `decision-records`

Contract:
- 已返回的决策状态快照不得被后续源对象修改反向污染。

Proves:
- 修改原始对象后，既有快照内容保持不变。
