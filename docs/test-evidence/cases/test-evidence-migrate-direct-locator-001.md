### Case TEST-EVIDENCE-MIGRATE-DIRECT-LOCATOR-001: 迁移拒绝非项目相对 direct locator

Tests:
- `test:ac379544c2ebaf27ea96850069a5473410e283e02eba63d869b3ab7c409a9ed9`

Tags:
- `repository-tooling`

Contract:
- direct file/full-name locator 与 selector 文件同样只能使用 POSIX 项目相对路径。

Proves:
- 绝对、上级和反斜杠文件路径均在映射前被拒绝。
