### Case RECORD-TRANSACTION-OLD-PATH-WINNER-001: 共同恢复不覆盖旧位置新建winner

Tests:
- `test:07d84f17a0ffcfd8c6556ddc2f96cbec21b8004ad635e1df22c09996ddcc0c89`
- `test:2fbb2c32a499366cf72a852ca08b5dd3a3878b61186111ec27514ae50a1d109d`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 旧路径仅缺失时独占恢复。

Proves:
- rename后旧路径被外部重建，再注入index失败，保留外部新建且报告partial-or-unknown。
