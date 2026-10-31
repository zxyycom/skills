### Case SKILL-RELEASE-PUBLISH-002: 快照发布创建一次并复用相同资产

Tests:
- `test:f3d2bd5af92db93b89451cc003997e8da0600e7345eaf612665b91612859dd12`

Tags:
- `repository-tooling`

Contract:
- 不可变快照由 package hash 前 12 位标识；不存在时创建，完整资产名称、字节数和 SHA-256 digest 一致时复用。

Proves:
- 首次发布以当前提交为 target 创建非 Latest 快照。
- 同名快照资产完全一致时只读取远端状态，不执行任何写命令。
