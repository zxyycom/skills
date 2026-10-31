### Case TEST-EVIDENCE-MIGRATE-CONFLICT-001: 迁移拒绝已有目标目录

Tests:
- `test:ec737307daaa141fb3e3e7c181544f1bec59b124f5e8a6291b312d8aae28ca76`

Tags:
- `repository-tooling`

Contract:
- 迁移不得与既有目标目录合并或删除其无关内容。

Proves:
- 已有 target directory 时写入被拒绝，旧源和目标中的无关文件保持原样。
