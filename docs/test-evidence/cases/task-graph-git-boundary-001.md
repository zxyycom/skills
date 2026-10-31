### Case TASK-GRAPH-GIT-BOUNDARY-001: mutation 不接管 Git 生命周期或 ignore 策略

Tests:
- `test:d25266a94bff1831d797f772adf1ef6c0483e44f3ede7430b063a95abf590f42`

Tags:
- `task-graph`

Contract:
- task-graph 只写权威索引，不创建局部 `.gitignore`、工作区 lock，也不自动 stage 或 commit。

Proves:
- mutation 后索引保持未暂存、HEAD 不变，调用方创建的临时文件仍是未跟踪状态，工作区没有 task-graph `.gitignore` 或相邻 lock。
