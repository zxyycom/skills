### Case DECISION-FILESYSTEM-TRANSACTION-001: 事务预检拒绝非普通决策文件

Tests:
- `test:67d2d64a9664ce754ae141f969f9f810f43f00bbab4cc1aef2779e5df76b9534`

Tags:
- `decision-records`

Contract:
- 生命周期文件事务必须在写入前确认每个源是普通非符号链接文件。

Proves:
- 目录和指向决策目录外文件的符号链接均使预检报告无写入失败；索引、外部文件和不安全源入口保持原状。
