### Case DECISION-FILESYSTEM-TRANSACTION-001: 所选同步拒绝符号链接来源

Tests:
- `test:ddc6bc32caf655dc4e099bea61603c6cf6a1b4b8cdf8a06cf0ee7a8180daabab`

Tags:
- `decision-records`

Contract:
- selected sync 的所选正文须为安全普通文件。

Proves:
- 真实 CLI 在普通来源下同步成功；替换为指向外部的 symlink 后 selected sync 以安全诊断拒绝，索引和外部文件字节保持。
