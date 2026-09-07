### Case TASK-GRAPH-LIST-FIELDS-001: Node 显示字段保持固定顺序

Tests:
- `test:557127b94b500031335d5d30c00169754bb6ed934cfcffb0e077e4cc5021de3b`

Tags:
- `task-graph`

Contract:
- Node 显示字段固定按 parent、needs、blocked-by、mutex、reason、next、title 排列。

Proves:
- 同时存在全部字段时逐项顺序保持固定，中文与 emoji title 位于最后且保持原值。
