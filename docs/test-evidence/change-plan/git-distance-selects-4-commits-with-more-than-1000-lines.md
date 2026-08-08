### Case CHANGE-PLAN-GIT-CHURN-001: Git 距离识别提交数与变更量联合阈值
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance-v1 selects 4 commits with more than 1000 lines`
- `bun test --test-name-pattern="^git-distance-v1 selects 4 commits with more than 1000 lines$" ./tools/change-plan/tests/run.ts`
Contract:
- `git-distance-v1` 在相关提交超过 3 个且累计变更超过 1000 行时判为搁置候选。
Proves:
- 4 个相关提交和 1001 行变更得到 `shelve-candidate`。
