### Case DECISION-LIFECYCLE-EXISTING-GUARD-001: 既有活动决策拒绝不适用的生命周期动作

Tests:
- `test:99db5c2f6adb4327b45c806eb88be3a4360b4ecfd29dfeecbfb609c19ec2813b`

Tags:
- `decision-records`

Contract:
- reactivate 只接受归档决策。

Proves:
- 生命周期规则对 active 决策的 reactivate 返回 RequiresArchived。
