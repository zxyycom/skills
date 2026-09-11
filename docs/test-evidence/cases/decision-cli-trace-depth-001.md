### Case DECISION-CLI-TRACE-DEPTH-001: Trace 验证查询范围参数

Tests:
- `test:0c535617777f8d00964f8fdcf2d3c507aadc5651b55ad0e66fbd9b7a01c6a91f`
- `test:cc4fdf0c53274c80404fe585847736815cf0463782fb626536f2132089c6241c`
- `test:cc84d4cc92b53b7364f1017137aa59bfb60b395639173d9f631a9594e51f9986`
- `test:e656b4fbc832c8b6d4e575654fa986ce818c10d8453f461fdc395f06d47dc2b4`
- `test:ffe360fc6e0ddbcaa3f6bd13d6a008835050a9becf1cddf5e949704db2dc4e6f`

Tags:
- `decision-records`

Contract:
- Trace 的 CLI 与直接查询 API 均必须接受非负安全 depth 或 all，以及正安全记录预算。

Proves:
- `--depth -1` 使 trace 退出 2 并报告 must be a non-negative integer。
- `--depth all` 关闭深度限制；无效 depth 或 max-records 均以参数错误退出，且有效记录预算进入查询请求。
- 重复 direction、depth 或 max-records 均以参数错误退出 2。
- 直接 API 与 CLI 对合法的 depth 0、maxRecords 1 回显同一 limits 并只保留 anchor。
- 直接 API 在读取索引前拒绝非法 direction、depth 与 maxRecords。
