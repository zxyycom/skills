### Case DECISION-RELATION-GRAPH-TRACE-001: 共享关系图执行有界双向追踪

Tests:
- `test:4156d79e73f63cac4105f296e30e6b21a2e76d55145360e10eada68837b83ae7`

Tags:
- `decision-records`

Contract:
- 共享关系图按方向和最大深度返回确定的内部子图。

Proves:
- 深度一的双向追踪包含直接前序和后继；深度零仅保留起点。
