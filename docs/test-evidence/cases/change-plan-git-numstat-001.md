### Case CHANGE-PLAN-GIT-NUMSTAT-001: Git 距离累计新增与删除行

Tests:
- `test:f74832bc7e340a5ee40a1e35e23b87e976b61745c4d124b3c3cd9d9a7449d1de`

Tags:
- `change-plan`

Contract:
- Git 距离的变更量必须累计相关提交中的新增行与删除行。

Proves:
- 新增三行后以两行替换该文件得到 2 个相关提交和累计 8 行变更。
