### Case VERSION-CONTROL-REPOSITORY-001: 拒绝非 Git 仓库目录

Tests:
- `test:0b77361f6968437a470f3960da5f42e3730042b2c25c7730c2716fa390a64688`

Tags:
- `version-control`

Contract:
- 打开版本控制边界前必须确认目标位于 Git 仓库。

Proves:
- 普通目录返回 `not-repository`。
