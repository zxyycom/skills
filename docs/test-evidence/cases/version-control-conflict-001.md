### Case VERSION-CONTROL-CONFLICT-001: 索引含冲突时拒绝 pending 读取

Tests:
- `test:057086f8ddad7fc46ecf7b2370a5d7188e1b8cfdb6a7a8402300def9f452d6e9`

Tags:
- `version-control`

Contract:
- pending 内容无法唯一确定时必须显式失败。

Proves:
- 合并冲突索引返回 `operation-failed` 并要求先解决 pending 内容冲突。
