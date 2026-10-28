### Case RECORD-COST-CASE-001: 精确目录与子路径

Tests:
- `test:038587a8442972668f804793378f20cdc17f021c00139b4e247f97e4813122f9`

Tags:
- `record-cost`

Contract:
- 请求精确目录必须按非文件失败，即使全部子路径同时请求。

Proves:
- 真实 Git 单文件目录与子文件分别返回失败和字节。
