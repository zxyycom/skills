### Case CHANGE-PLAN-COMPLETE-005: 删除准备拒绝 Git 特殊 tree entry

Tests:
- `test:e61e12e095463a37201bb3e40396bf848892d6bca5bbfd419cc9f17711979c7d`

Tags:
- `change-plan`

Contract:
- 删除准备只允许 Git `100644` 或 `100755` regular blob；Git symbolic link 和 submodule 不是可恢复删除成员。

Proves:
- Git symlink 与 Gitlink `160000` 均在准备阶段 fail closed。
- 对应 source 目录均没有被移动。
