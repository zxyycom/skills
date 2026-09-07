### Case VERSION-CONTROL-CONFLICT-001: 索引含冲突时拒绝 pending 读取

Tests:
- `test:f7cf4c1b4a4f1f8943ce38691640a01e2d73edd608b39a158ede399a59d88768`

Tags:
- `version-control`

Contract:
- pending 内容无法唯一确定时必须显式失败。

Proves:
- 合并冲突索引返回 `operation-failed` 并要求先解决 pending 内容冲突。
