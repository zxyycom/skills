### Case TEST-EVIDENCE-MIGRATE-DIRECT-LOCATOR-001: 迁移拒绝非项目相对 direct locator

Tests:
- `test:f36e111be4d59f00c7124429b6a1d513e719dbfae57312f5dbd8a844f3d7a4cd`

Tags:
- `repository-tooling`

Contract:
- direct file/full-name locator 与 selector 文件同样只能使用 POSIX 项目相对路径。

Proves:
- 绝对、上级和反斜杠文件路径均在映射前被拒绝。
