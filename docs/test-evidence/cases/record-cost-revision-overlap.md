### Case RECORD-COST-CASE-001: 精确目录与子路径

Tests:
- `test:415af075bc9206a7aa0650c8bf511fbce424ca45fd908b2ec51ff0707ccf789e`

Tags:
- `record-cost`

Contract:
- 请求精确目录必须按非文件失败，即使全部子路径同时请求。

Proves:
- 真实 Git 单文件目录与子文件分别返回失败和字节。
