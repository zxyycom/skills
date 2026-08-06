### Case TASK-GRAPH-GIT-BOUNDARY-001: mutation 只产生未暂存索引修改，HEAD 不变且三类运行态辅助路径显示为 ignored

Entry:
- `tools/task-graph/tests/scope-repository.test.ts > task index mutations leave Git staging and commits caller-owned while runtime artifacts stay ignored`
- `bun test --test-name-pattern="^task index mutations leave Git staging and commits caller-owned while runtime artifacts stay ignored$" ./tools/task-graph/tests/run.ts`

Contract:
- task-graph 只写权威索引，不自动 stage 或 commit；lock、temp 与 quarantine 路径由 Git 忽略。

Proves:
- mutation 只产生未暂存索引修改，HEAD 不变且三类运行态辅助路径显示为 ignored。
