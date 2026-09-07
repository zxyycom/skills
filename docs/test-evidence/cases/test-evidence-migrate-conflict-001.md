### Case TEST-EVIDENCE-MIGRATE-CONFLICT-001: 迁移拒绝已有目标目录

Tests:
- `test:d03d7bf5cdd29610c089329d43a409586d31cb8edd4b5b4d093b98ee7945cd91`

Tags:
- `repository-tooling`

Contract:
- 迁移不得与既有目标目录合并或删除其无关内容。

Proves:
- 已有 target directory 时写入被拒绝，旧源和目标中的无关文件保持原样。
