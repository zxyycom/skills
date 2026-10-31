### Case INDEX-RUNTIME-QUERY-001: 过滤决策状态并按稳定标识查找

Tests:
- `test:94e8eb424da43ac77eee68e229ad2f42357df2813d7bc029f9996ba9a69cd795`

Tags:
- `index-runtime`

Contract:
- 查询必须按文本、范围和精确条件过滤，并支持稳定标识查找。

Proves:
- 决策索引返回各过滤条件和直接查找对应的唯一状态。
