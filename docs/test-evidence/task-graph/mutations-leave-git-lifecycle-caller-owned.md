### Case TASK-GRAPH-GIT-BOUNDARY-001: mutation 不接管 Git 生命周期或 ignore 策略

Entry:
- `tools/task-graph/tests/task-removal.test.ts > task index mutations leave Git staging, commits, and ignore policy caller-owned`
- `bun test --test-name-pattern="^task index mutations leave Git staging, commits, and ignore policy caller-owned$" ./tools/task-graph/tests/run.ts`

Contract:
- task-graph 只写权威索引，不创建局部 `.gitignore`、工作区 lock，也不自动 stage 或 commit。

Proves:
- mutation 后索引保持未暂存、HEAD 不变，调用方创建的临时文件仍是未跟踪状态，工作区没有 task-graph `.gitignore` 或相邻 lock。
