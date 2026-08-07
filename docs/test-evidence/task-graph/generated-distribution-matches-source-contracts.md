### Case TASK-GRAPH-DISTRIBUTION-001: 分发制品与源码公共契约一致

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > generated distribution matches source API, schema bytes, and portable metadata`
- `bun test --test-name-pattern="^generated distribution matches source API, schema bytes, and portable metadata$" ./tools/task-graph/tests/run.ts`

Contract:
- task-graph 分发脚本、从公开实现机械派生的声明闭包、source map 与 JSON Schema 必须由当前源码确定性生成并保持可移植；标准 draft 2020-12 consumer 与运行时必须接受和拒绝同一批可表达约束。

Proves:
- bundled/source exports 与 2.0.0 行为一致，公开根级任务投影和批量删除而不暴露 scope API；同名声明入口及其可达声明树可被独立 TypeScript consumer 使用，允许省略 acceptance，且不暴露 native、runner、store、内部注入类型或 Valibot。`write-file-atomic` 已内联、native 包未内联、bundle 无工作区绝对路径；Schema 与运行时共同拒绝长度、格式和错误文本类型等全部可表达约束。
