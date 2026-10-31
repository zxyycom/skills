### Case DECISION-RELATION-GRAPH-DUPLICATE-001: 共享关系图报告重复 source-target 边

Tests:
- `test:b699d151f3ddb47675c389720eb6fbe8708bf8e80925be743cd00d045d2d5b41`

Tags:
- `decision-records`

Contract:
- 同一 source-target 的第二条边必须保留第一条边定位并报告重复。

Proves:
- 重复边产生 `duplicate-edge` 及 repeatedEdge 数据。
