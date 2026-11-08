### Case DECISION-LIFECYCLE-ARCHIVED-DISCARD-001: 丢弃归档记录删除路径与索引身份

Tests:
- `test:6a6cade9052da091bc088374814e80fac3f43d55140d254537bd36c554fc8b48`

Tags:
- `decision-records`

Contract:
- 无引用归档记录可显式丢弃，来源与正式索引身份一同移除。

Proves:
- 真实 CLI 归档后 discard 成功，归档来源消失，索引不再含该唯一身份。
