### Case CHANGE-PLAN-GIT-NUMSTAT-001: Git 距离累计新增与删除行

Tests:
- `test:e42fcf657636038acdc85116229257e5131445f29b09242f51e7ac127e8796d3`

Tags:
- `change-plan`

Contract:
- Git 距离的变更量必须累计相关提交中的新增行与删除行。

Proves:
- 新增三行后以两行替换该文件得到 2 个相关提交和累计 8 行变更。
