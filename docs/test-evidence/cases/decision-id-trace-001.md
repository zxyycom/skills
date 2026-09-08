### Case DECISION-ID-TRACE-001: 稳定 ID 的 Trace 关系

Tests:
- `test:649b4590cc79ed5adb67f5a09042a563f77d0779ff0bf263b43cdb43344f0fb6`

Tags:
- `decision-records`

Contract:
- trace 按稳定 ID 解析 active 与 archived 记录的关系，并呈现每个已建立节点的明确 alignment。

Proves:
- 活动记录的 trace 输出归档关系目标、active/aligned 和 archived/unaligned 节点，且不输出 unknown 或 null。
