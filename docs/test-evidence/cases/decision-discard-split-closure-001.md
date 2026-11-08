### Case DECISION-DISCARD-SPLIT-CLOSURE-001: Discard 拒绝会打开拆分闭包的后继

Tests:
- `test:dc7422c5be88f63a3e3728be2d66b6caef154677b8e8f56e83c0490c53a7e679`

Tags:
- `decision-records`

Contract:
- direct discard 不能删除拆分后继而留下开放拆分图。

Proves:
- 两个活动后继指向同一归档拆分前序时，丢弃其中一个失败且两个后继与索引保持原字节。
