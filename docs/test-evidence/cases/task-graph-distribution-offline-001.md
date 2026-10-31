### Case TASK-GRAPH-DISTRIBUTION-OFFLINE-001: 生成 CLI 从隔离 runtime 离线 mutation

Tests:
- `test:f2501c7a770bf97a2f2d2e4cb64626218f24b9be2a7840038ee230a9744d7114`

Tags:
- `task-graph`

Contract:
- 调用方准备 runtime 后，生成 ESM 从 `TASK_GRAPH_TOOL_HOME` 的固定目录加载 addon，普通 mutation 不运行 npm 或联网。

Proves:
- 显式 Node 的生成 CLI 使用调用方准备的 runtime 完成 index init；实际索引字节等于独立固定的 schemaVersion 2、revision 0、nextTaskId 1 与空 tasks 的完整 JSON，工作区不产生相邻锁文件。
