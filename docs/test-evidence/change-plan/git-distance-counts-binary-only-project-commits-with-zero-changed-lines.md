### Case CHANGE-PLAN-GIT-DISTANCE-BINARY-001: Git 距离计入二进制提交但不虚构行数
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance-v1 counts binary-only project commits with zero changed lines`
- `bun test --test-name-pattern="^git-distance-v1 counts binary-only project commits with zero changed lines$" ./tools/change-plan/tests/run.ts`
Contract:
- 当前 Change 外的二进制提交仍属于项目演进，但 Git 无行数时 additions 与 deletions 只能按零累计。
Proves:
- 新增仅含二进制文件的项目提交产生 `commitCount: 1`、`changedLines: 0`，并按固定阈值保持 `current`。
