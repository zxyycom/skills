### Case DECISION-RELATION-GRAPH-DUPLICATE-001: 共享关系图报告重复 source-target 边

Tests:
- `test:553a2a2c7f0c737dc8b7a5dded15c522f2590fb423bb9591fbc051a102e101e8`
- `test:9d63c569c71661d30454d86f8d103446a55e610e2d11465a01d34f31f4fe57d4`

Tags:
- `decision-records`

Contract:
- 同一 source-target 的第二条边必须保留第一条边定位并报告重复。

Proves:
- 重复边产生 `duplicate-edge` 及 repeatedEdge 数据。
