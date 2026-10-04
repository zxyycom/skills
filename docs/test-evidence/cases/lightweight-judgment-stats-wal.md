### Case LIGHTWEIGHT-JUDGMENT-STATS-WAL-001: 活跃 WAL 与一致快照

Tests:
- `test:28d53357b59cc72378a0dfbfdbb893048a3bd1b9dfa3c70d87f0125eaff22900`

Tags:
- `lightweight-judgment`

Contract:
- 只读事务读取已提交活跃 WAL 数据且不变更 schema／journal；快照内后续并发提交不可改变已捕获集合。

Proves:
- 真实 WAL 已提交调用被 stats 读到，主库字节、version与journal不变；writer 再提交后既有 reader 仍见1、新stats见2。
