### Case CHANGE-PLAN-GIT-NUMSTAT-001: Git 距离累计新增与删除行
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance-v1 accumulates additions and deletions`
- `bun test --test-name-pattern="^git-distance-v1 accumulates additions and deletions$" ./tools/change-plan/tests/run.ts`
Contract:
- `git-distance-v1` 的变更量必须累计相关提交中的新增行与删除行。
Proves:
- 新增三行后以两行替换该文件得到 2 个相关提交和累计 8 行变更。
