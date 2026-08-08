### Case CHANGE-PLAN-GIT-COMMITS-001: Git 距离识别九个低变更提交
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance-v1 selects 9 low-churn commits`
- `bun test --test-name-pattern="^git-distance-v1 selects 9 low-churn commits$" ./tools/change-plan/tests/run.ts`
Contract:
- `git-distance-v1` 在相关提交达到 9 个时，不依赖累计变更量即可判为搁置候选。
Proves:
- 9 个各增加一行的相关提交得到 9 行证据和 `shelve-candidate`。
