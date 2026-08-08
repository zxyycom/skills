### Case CHANGE-PLAN-GIT-PATHS-001: Git 距离按目录边界统计混合提交
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance-v1 counts sibling paths and only outside lines in mixed commits`
- `bun test --test-name-pattern="^git-distance-v1 counts sibling paths and only outside lines in mixed commits$" ./tools/change-plan/tests/run.ts`
Contract:
- 同一提交同时修改当前 Change 与外部路径时，`git-distance-v1` 计入该提交但只累计外部路径行数，名称相近的兄弟目录仍属于外部路径。
Proves:
- 混合提交被计为 1 个相关提交，当前目录的一行被排除，兄弟目录的两行被计入。
