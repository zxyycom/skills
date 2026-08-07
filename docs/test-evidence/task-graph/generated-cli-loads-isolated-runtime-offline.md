### Case TASK-GRAPH-DISTRIBUTION-OFFLINE-001: 生成 CLI 从隔离 runtime 离线 mutation

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > generated Node CLI loads only the isolated runtime and mutates offline after installation`
- `bun test --test-name-pattern="^generated Node CLI loads only the isolated runtime and mutates offline after installation$" ./tools/task-graph/tests/run.ts`

Contract:
- 安装完成后生成 ESM 从 `TASK_GRAPH_TOOL_HOME` 的当前 runtime 加载 addon，普通 mutation 不运行 npm 或联网。

Proves:
- 显式 Node 的 runtime check 和 index init 成功，工作区产生普通稳定锁文件。
