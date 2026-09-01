### Case TASK-GRAPH-DISTRIBUTION-004: portable build 不依赖 checkout 绝对路径

Entry:
- `tools/task-graph/tests/portable-build.test.ts > generated task graph bundle and source map are checkout-path independent`
- `bun test --test-name-pattern="^generated task graph bundle and source map are checkout-path independent$" ./tools/task-graph/tests/portable-build.test.ts`

Contract:
- portable-build 只证明 Task Graph 生成入口在不同 checkout 路径下可复现：bundle、source map、声明入口和完整声明树必须逐字节一致。
- 它不承接运行时导出、SDK 声明可消费性、Schema 或分发依赖边界；这些公共分发契约由 `TASK-GRAPH-DISTRIBUTION-001` 承接。

Proves:
- 两个不同长度的隔离源码与依赖树分别执行真实生成入口后，`task-graph.mjs`、`.map`、根声明和声明树逐字节一致，且 bundle 与 source map 不保留构建相关 debug ID。
