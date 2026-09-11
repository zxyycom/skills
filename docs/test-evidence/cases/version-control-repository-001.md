### Case VERSION-CONTROL-REPOSITORY-001: 拒绝非 Git 仓库目录

Tests:
- `test:b5503705775cb873b3a85b0a08316dc0f59781ea756ac623646de875d4d249e3`

Tags:
- `version-control`

Contract:
- 打开版本控制边界前必须确认目标位于 Git 仓库。

Proves:
- 普通目录返回 `not-repository`。
