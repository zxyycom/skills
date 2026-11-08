### Case DECISION-ID-TRACE-001: 稳定 ID 的 Trace 关系

Tests:
- `test:3cad69a8c65e25f8d5be408deedb9aafeb16bd1813608a8e63da65af0d01eaa9`

Tags:
- `decision-records`

Contract:
- trace 按稳定 ID 解析 active 与 archived 记录的关系，并呈现每个已建立节点的明确 alignment。

Proves:
- 原生发布索引 trace 投影返回活动与归档 ID，保留修订 target，分别报告 active/aligned 和 archived/unaligned；该节点不验证 CLI 呈现。
