### Case TASK-GRAPH-DISTRIBUTION-001: 分发制品与源码公共契约一致

Tests:
- `test:8c3e7d65b49480978dd036c80ac0ed0489720cfeb441671986a89dec173ffc75`

Tags:
- `task-graph`

Contract:
- 当前 Task-graph 分发脚本、公开声明闭包、自有 TS 与 JSON Schema 必须与当前源码契约一致；标准 draft 2020-12 consumer 与运行时必须接受和拒绝同一批可表达约束。
- 本 case 只承接公共分发契约；跨 checkout 的生成字节可复现性由 `TASK-GRAPH-DISTRIBUTION-004` 承接。

Proves:
- 生成模块与源码 runtime export 集合和 version 结果一致。
- 根声明及其可达声明树可被独立 TypeScript consumer 使用，导出 `TaskListItem` 与 `TaskIndexStageResult`、允许调用 `stageTaskIndex()`，并能用 `state` 将 `changed` 收窄为对应布尔字面量；声明不保留 `TaskSummary`，且不暴露 native、runner、store、内部注入类型或 Valibot。
- 自有 TS 闭包保留专用 renderer、声明普通依赖而不分发 native package；公开入口不含工作区绝对路径，旧 MJS map 已移除。
- JSON Schema 与运行时共同拒绝长度、格式和错误文本类型等全部可表达约束。
- 直接 TS 消费保留 Service 类类型名并拒绝内部 store、constructor 与 CLI 注入；公开类和 runner 严格等于包内运行引用。
