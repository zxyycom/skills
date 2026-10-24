### Case RECORD-TRANSACTION-ACTUAL-RECOVERY-001: 共同事务只恢复真实写集

Tests:
- `test:5c78eae3a3483ab7a121ef14f788b2b5e39ed62e883f700a0cb83eaf4eb526b3`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 提交前恢复只撤销实际写入，并证明完整旧范围。

Proves:
- 第二份写入前注错，仅第一份进入writtenPaths，来源与索引旧字节和mode恢复，返回rolled-back。
