### Case RECORD-TRANSACTION-ACTUAL-RECOVERY-001: 共同事务只恢复真实写集

Tests:
- `test:9fefafee23b1a42ba2b10bd825a266baed87e920bfc797709905a794a3621bd4`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 提交前恢复只撤销实际写入，并证明完整旧范围。

Proves:
- 第二份写入前注错，仅第一份进入writtenPaths，来源与索引旧字节和mode恢复，返回rolled-back。
