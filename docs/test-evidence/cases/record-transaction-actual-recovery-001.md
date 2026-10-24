### Case RECORD-TRANSACTION-ACTUAL-RECOVERY-001: 共同事务只恢复真实写集

Tests:
- `test:f1c7f96f70303a5ce9f4a968262507e6cf5ebd144d55cc42007f712b0a045588`
- `test:f9599c259090cf82b9176bcadb8209b4db046b869a11b5e71389843519406e46`

Tags:
- `decision-records`
- `investigation-report`
- `record-operations`

Contract:
- 提交前恢复只撤销实际写入，并证明完整旧范围。

Proves:
- 第二份写入前注错，仅第一份进入writtenPaths，来源与索引旧字节和mode恢复，返回rolled-back。
