### Case CHANGE-PLAN-GIT-BOUNDARY-001: Git 距离边界保持当前状态
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance-v1 keeps the 3 commit and 1000 line boundary current`
- `bun test --test-name-pattern="^git-distance-v1 keeps the 3 commit and 1000 line boundary current$" ./tools/change-plan/tests/run.ts`
Contract:
- `git-distance-v1` 在恰好 3 个相关提交和 1000 行变更时不得判为搁置候选。
Proves:
- 测得的提交数为 3、变更行为 1000，评估结果为 `current`。
