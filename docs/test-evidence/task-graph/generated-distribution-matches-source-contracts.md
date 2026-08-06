### Case TASK-GRAPH-DISTRIBUTION-001: 分发制品与源码公共契约一致

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > generated distribution matches source API, schema bytes, and portable metadata`
- `bun test --test-name-pattern="^generated distribution matches source API, schema bytes, and portable metadata$" ./tools/task-graph/tests/run.ts`

Contract:
- task-graph 分发脚本、收窄后的声明、source map 与 JSON Schema 必须由当前源码确定性生成并保持 LF 字节稳定；标准 draft 2020-12 consumer 与运行时必须接受和拒绝同一批可表达约束。

Proves:
- bundled/source runtime exports 与 version 行为一致，声明不暴露 store、hook、generator 或 process seams，source map 可移植且 Schema 字节匹配单一真源；Ajv 与运行时共同验证 Unicode code-point 文本边界、首尾空白与单行约束、scope/dictionary key 上限、正 canonical ID，以及 `constructor`、`prototype`、`__proto__` 持久字典保留字拒绝。
