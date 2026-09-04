### Case CHANGE-PLAN-COMPLETE-005: 删除准备拒绝 Git 特殊 tree entry
Entry:
- `tools/change-plan/tests/complete.test.ts > complete rejects Git symlink and submodule tree entries without moving`
- `bun test --test-name-pattern="^complete rejects Git symlink and submodule tree entries without moving$" ./tools/change-plan/tests/run.ts`
Contract:
- 删除准备只允许 Git `100644` 或 `100755` regular blob；Git symbolic link 和 submodule 不是可恢复删除成员。
Proves:
- Git symlink 与 Gitlink `160000` 均在准备阶段 fail closed。
- 对应 source 目录均没有被移动。
