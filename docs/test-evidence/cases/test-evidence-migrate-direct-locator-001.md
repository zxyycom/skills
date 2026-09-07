### Case TEST-EVIDENCE-MIGRATE-DIRECT-LOCATOR-001: 迁移拒绝非项目相对 direct locator

Tests:
- `test:3b131661c2c21580dd43a3f2fb38736f9d6383b5852717638a5d79e77d786a2b`

Tags:
- `repository-tooling`

Contract:
- direct file/full-name locator 与 selector 文件同样只能使用 POSIX 项目相对路径。

Proves:
- 绝对、上级和反斜杠文件路径均在映射前被拒绝。
