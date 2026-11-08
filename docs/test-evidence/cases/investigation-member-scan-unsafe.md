### Case INVESTIGATION-MEMBER-SCAN-UNSAFE-001: 检查拒绝目录占用报告成员路径

Tests:
- `test:ae42ded23d29f2af769d620f3edcda11d54a8d40e8f3ab7902350380ed51de59`

Tags:
- `investigation-report`

Contract:
- 调查来源成员的位置不得是目录。

Proves:
- 选中检查 fixture 将 other.md 替换成目录后返回 member-invalid，不将其忽略为合法来源。
