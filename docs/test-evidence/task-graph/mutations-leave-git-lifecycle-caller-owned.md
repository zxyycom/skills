### Case TASK-GRAPH-GIT-BOUNDARY-001: mutation 只产生未暂存索引修改，HEAD 不变且局部规则忽略运行态文件

Entry:
- `tools/task-graph/tests/scope-repository.test.ts > task index mutations leave Git staging and commits caller-owned while runtime artifacts stay ignored`
- `bun test --test-name-pattern="^task index mutations leave Git staging and commits caller-owned while runtime artifacts stay ignored$" ./tools/task-graph/tests/run.ts`

Contract:
- task-graph 只写权威索引和首次 init 所需的局部 `.gitignore`，不自动 stage 或 commit；稳定 lock 与 atomic temp 由局部规则忽略。

Proves:
- mutation 只产生未暂存索引修改，HEAD 不变，稳定 lock 与 atomic temp 显示为 ignored。
