### Case TASK-GRAPH-DISTRIBUTION-IMPORT-001: 生成模块导入在空 tool home 无副作用

Entry:
- `tools/task-graph/tests/generated-artifacts.test.ts > generated module import is side-effect free in an empty tool home under supported Node`
- `bun test --test-name-pattern="^generated module import is side-effect free in an empty tool home under supported Node$" ./tools/task-graph/tests/run.ts`

Contract:
- 导入生成 ESM 不读取或创建用户 runtime，不加载 addon，不写 stdout/stderr。

Proves:
- 显式受支持 Node 导入后输出为空，隔离 tool home 仍不存在。
