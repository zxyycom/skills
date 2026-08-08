### Case CHANGE-PLAN-GIT-EXCLUDE-001: Git 距离排除仅修改当前 Change 的提交
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance-v1 excludes commits that only change the assessed directory`
- `bun test --test-name-pattern="^git-distance-v1 excludes commits that only change the assessed directory$" ./tools/change-plan/tests/run.ts`
Contract:
- `git-distance-v1` 只衡量当前 Change 目录之外的项目推进。
Proves:
- 只修改被评估 Change 制品的提交不增加提交数或变更行数，结果仍为 `current`。
