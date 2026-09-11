### Case INDEX-RUNTIME-KEY-VALUE-001: 提取封闭查询 source 并拒绝非法 source 值

Tests:
- `test:5c109e87db759999cdc7e4c03e053db0939fd5eb84808bef8cbd19bda41a1f8f`

Tags:
- `index-runtime`

Contract:
- Entry ID、多个 state path、终点数组、显式 `each`、单值 instant 和固定 `sourcePath` 首段使用同一提取与规范化协议；缺失路径为空值，非法容器、标量、时间或相对路径必须形成可定位诊断。

Proves:
- 组合 filter 能命中规范化、去重后的查询值，缺失字段满足 `exists: false`，持久 snapshot 不含查询投影。
- 非法文本标量、`each` 容器、instant cardinality 与 `sourcePath` 都返回包含 entry ID、字段和 source 的 `state-index.query-field-source-invalid`。
