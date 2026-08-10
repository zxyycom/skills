### Case TASK-GRAPH-DISTRIBUTION-001: 分发制品与源码公共契约一致

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > generated distribution matches source API, schema bytes, and portable metadata`
- `bun test --test-name-pattern="^generated distribution matches source API, schema bytes, and portable metadata$" ./tools/task-graph/tests/run.ts`

Contract:
- Task-graph 分发脚本、公开声明闭包、source map 与 JSON Schema 必须由当前源码确定性生成并保持可移植；标准 draft 2020-12 consumer 与运行时必须接受和拒绝同一批可表达约束。

Proves:
- 生成模块与源码 runtime export 集合和 version 结果一致。
- 根声明及其可达声明树可被独立 TypeScript consumer 使用，导出 `TaskListItem` 与 `TaskIndexStageResult`、允许调用 `stageTaskIndex()`，并能用 `state` 将 `changed` 收窄为对应布尔字面量；声明不保留 `TaskSummary`，且不暴露 native、runner、store、内部注入类型或 Valibot。
- Bundle 内联预期依赖、不携带 native package 或工作区绝对路径；source map 使用相对跨平台路径并追踪专用 renderer 源码。
- JSON Schema 与运行时共同拒绝长度、格式和错误文本类型等全部可表达约束。
