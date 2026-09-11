### Case TEST-EVIDENCE-MIGRATE-CONFLICT-001: 迁移拒绝已有目标目录

Tests:
- `test:2de694f5c705f0dfccbfd62ca74e4bd27f957d6790606d597306d589eda498dd`

Tags:
- `repository-tooling`

Contract:
- 迁移不得与既有目标目录合并或删除其无关内容。

Proves:
- 已有 target directory 时写入被拒绝，旧源和目标中的无关文件保持原样。
