### Case RESOURCE-SELECTION-TRACE-001: 图包成员的下游用途

Tests:
- `test:e90c0d0b989113856f537432952c2d066faf03785cc250300014ffe22a21b910`

Tags:
- `resource-records`

Contract:
- 显式 selection 查询须从实际选中对象查询，不以成员解析丢失选择关系。

Proves:
- 图包成员作为选择目标时，下游边保留集合与该精确成员。
