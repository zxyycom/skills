### Case TASK-GRAPH-DISTRIBUTION-OFFLINE-001: 生成 CLI 从隔离 runtime 离线 mutation

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > generated Node CLI probes the isolated runtime and mutates offline`
- `bun test --test-name-pattern="^generated Node CLI probes the isolated runtime and mutates offline$" ./tools/task-graph/tests/run.ts`

Contract:
- 调用方准备 runtime 后，生成 ESM 从 `TASK_GRAPH_TOOL_HOME` 的固定目录加载 addon，普通 mutation 不运行 npm 或联网。

Proves:
- 显式 Node 的 runtime info 真实探针和 index init 成功，工作区不产生相邻锁文件。
