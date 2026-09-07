### Case VERSION-CONTROL-REPOSITORY-001: 拒绝非 Git 仓库目录

Tests:
- `test:7738c965a36806c1eb7ba7c301deb1ed073a6ffbc5bfd900a1fa03534dc5fce9`

Tags:
- `version-control`

Contract:
- 打开版本控制边界前必须确认目标位于 Git 仓库。

Proves:
- 普通目录返回 `not-repository`。
