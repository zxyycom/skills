### Case CHANGE-PLAN-FINALIZE-005: Finalize 删除准备拒绝 Git 特殊 tree entry

Tests:
- `test:34335ce84e545ec1fe3dbc2434805978d00b453a73208bf885c3df6cc11d8a27`

Tags:
- `change-plan`

Contract:
- 删除准备只允许 Git `100644` 或 `100755` regular blob；Git symbolic link 和 submodule 不是可恢复删除成员。

Proves:
- Git symlink 与 Gitlink `160000` 均在准备阶段 fail closed。
- 对应 source 目录均没有被移动。
