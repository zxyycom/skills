### Case DECISION-CLI-TRACE-DEPTH-001: Trace 验证查询范围参数

Tests:
- `test:5d637b68527016f75ef01d0b4811d15920f5569f22edabe711114e04453836ae`
- `test:61d0d2d2e7934b8d469076fe7fea11e07e2185a60786a50ce956345ddd65a510`
- `test:6df1cffa89f42c1a2ad4099a17c2483821b7c7fa7bf548833c0b12de0e7e3a60`
- `test:cc84d4cc92b53b7364f1017137aa59bfb60b395639173d9f631a9594e51f9986`
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
