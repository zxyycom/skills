### Case VERSION-CONTROL-CONFLICT-001: 索引含冲突时拒绝 pending 读取

Tests:
- `test:85413c260c16304e0430facc676e56bd9d13eb19cd9166c263be56a8b50382c4`

Tags:
- `version-control`

Contract:
- pending 内容无法唯一确定时必须显式失败。

Proves:
- 合并冲突索引返回 `operation-failed` 并要求先解决 pending 内容冲突。
