### Case INDEX-RUNTIME-QUERY-001: 过滤决策状态并按稳定标识查找
Entry:
- `tools/index-runtime/tests/query.test.ts > filters decision states and finds entries by stable identity`
- `bun test --test-name-pattern="^filters decision states and finds entries by stable identity$" ./tools/index-runtime/tests/run.ts`
Contract:
- 查询必须按文本、范围和精确条件过滤，并支持稳定标识查找。
Proves:
- 决策索引返回各过滤条件和直接查找对应的唯一状态。
