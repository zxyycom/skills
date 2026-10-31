### Case RECORD-TRANSACTION-OLD-PATH-WINNER-001: 共同恢复不覆盖旧位置新建winner

Tests:
- `test:823769aa1caf30311345011183a8fdfc882e689af13e117885dbdc8c2764bd5f`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 旧路径仅缺失时独占恢复。

Proves:
- rename后旧路径被外部重建，再注入index失败，保留外部新建且报告partial-or-unknown。
