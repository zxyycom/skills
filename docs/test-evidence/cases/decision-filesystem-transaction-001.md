### Case DECISION-FILESYSTEM-TRANSACTION-001: 事务预检拒绝非普通决策文件

Tests:
- `test:1e27dff74e7ee0760f1cb967b32e939099114dc879c2d377310279a798263bf4`

Tags:
- `decision-records`

Contract:
- 生命周期文件事务必须在写入前确认每个源是普通非符号链接文件。

Proves:
- 目录和指向决策目录外文件的符号链接均使预检报告无写入失败；索引、外部文件和不安全源入口保持原状。
