### Case CHANGE-PLAN-GIT-DISTANCE-EMPTY-001: Git 距离计入无路径变化提交
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance-v1 counts empty project commits with zero changed lines`
- `bun test --test-name-pattern="^git-distance-v1 counts empty project commits with zero changed lines$" ./tools/change-plan/tests/run.ts`
Contract:
- Base 之后位于 first-parent 链上的无路径变化提交仍表示项目 revision 前进，必须计入 `commitCount`，但不能虚构变更行数。
Proves:
- 一个 `--allow-empty` 项目提交产生 `commitCount: 1`、`changedLines: 0`，并按固定阈值保持 `current`。
