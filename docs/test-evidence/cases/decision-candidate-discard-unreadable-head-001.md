### Case DECISION-CANDIDATE-DISCARD-UNREADABLE-HEAD-001: Discard 在 Git HEAD 不可读取时零写入失败

Tests:
- `test:3beb638ca84dc0e18d245a7f89e0c4a5e7324c927193c5ca5289f8cffd9ade60`

Tags:
- `decision-records`

Contract:
- 未确认删除候选时 Git HEAD 无法读取必须在删除前失败。

Proves:
- 候选提交后损坏当前 Git ref，discard 失败且未提交变化，候选和正式索引保持原字节。
