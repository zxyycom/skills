### Case DECISION-ID-TRACE-001: 稳定 ID 的 Trace 关系

Tests:
- `test:b7e1b65af5a7d93ae56d7e764c603e3c38ede3f241150def2605bac4dabc06be`

Tags:
- `decision-records`

Contract:
- trace 按稳定 ID 解析 active 与 archived 记录的关系，并呈现每个已建立节点的明确 alignment。

Proves:
- 活动记录的 trace 输出归档关系目标、active/aligned 和 archived/unaligned 节点，且不输出 unknown 或 null。
