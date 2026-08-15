### Case DECISION-GENERATED-METADATA-001: 生成决策 bundle 与 source map 元数据保持可移植

Entry:
- `tools/decision-records/tests/generated-artifacts.test.ts > generated decision bundle and source map retain portable metadata`
- `bun test --test-name-pattern="^generated\ decision\ bundle\ and\ source\ map\ retain\ portable\ metadata$" ./tools/decision-records/tests/run.ts`

Contract:
- 分发 bundle 与 source map 必须保留可定位的维护来源和不依赖 checkout 绝对路径的元数据。

Proves:
- bundle 标示 CLI 源、重建入口和 source map；source map 只含相对的正斜杠 workspace 路径。
