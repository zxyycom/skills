### Case CHANGE-PLAN-GIT-LINES-001: Git 距离识别单次三千行变更
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance-v1 selects one commit with 3000 changed lines`
- `bun test --test-name-pattern="^git-distance-v1 selects one commit with 3000 changed lines$" ./tools/change-plan/tests/run.ts`
Contract:
- `git-distance-v1` 在累计变更达到 3000 行时，不依赖提交数即可判为搁置候选。
Proves:
- 单个相关提交产生 3000 行变更证据和 `shelve-candidate`。
