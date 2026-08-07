### Case TASK-GRAPH-DISTRIBUTION-001: 分发制品与源码公共契约一致

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > generated distribution matches source API, schema bytes, and portable metadata`
- `bun test --test-name-pattern="^generated distribution matches source API, schema bytes, and portable metadata$" ./tools/task-graph/tests/run.ts`

Contract:
- task-graph 分发脚本、收窄后的声明、source map、JSON Schema 与两个 runtime 文本资产必须由当前源码确定性生成并保持可移植；标准 draft 2020-12 consumer 与运行时必须接受和拒绝同一批可表达约束。

Proves:
- bundled/source exports 与 version 行为一致，声明含稳定 runtime 类型但不暴露 native、runner、store 或 ambient Node 类型；`write-file-atomic` 已内联、native 包未内联、bundle 无工作区绝对路径，runtime 文本资产逐字节一致；Schema 与运行时继续共同验证全部可表达约束。
